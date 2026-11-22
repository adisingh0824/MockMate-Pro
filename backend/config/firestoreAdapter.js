const { getDb } = require('./firebase');

// Firestore returns Timestamp instances for fields written as JavaScript Dates.
// Normalize them before exposing model objects so Express JSON responses and
// the client receive consistent ISO strings for every date, including nested
// session/result fields.
const normalizeFirestoreValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeFirestoreValue(nestedValue)])
    );
  }
  return value;
};

// Helper to convert Firestore doc snapshot to a plain Mongoose-like object
const docToObject = (doc) => {
  if (!doc || !doc.exists) return null;
  const data = normalizeFirestoreValue(doc.data());
  const id = doc.id;
  const instance = {
    ...data,
    _id: id,
    id: id,
  };

  // Provide Mongoose compatibility methods
  instance.toObject = function () {
    return { ...this };
  };

  instance.toJSON = function () {
    return { ...this };
  };

  instance.select = function () {
    return this;
  };

  return instance;
};

// Builder for query chaining (.sort, .limit, .select)
class QueryBuilder {
  constructor(collectionRef, queryFilter = {}) {
    this.collectionRef = collectionRef;
    this.filter = queryFilter;
    this._sorts = []; // [{ field, direction }]
    this._limit = null;
    this._selectFields = null;
    this._isFindOne = false;
  }

  findOne() {
    this._isFindOne = true;
    this._limit = 1;
    return this;
  }

  select(fields) {
    if (typeof fields === 'string') {
      this._selectFields = fields.split(' ').map(f => f.trim()).filter(Boolean);
    }
    return this;
  }

  sort(sortParam) {
    this._sorts = [];
    if (typeof sortParam === 'string') {
      const parts = sortParam.split(' ').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith('-')) {
          this._sorts.push({ field: p.substring(1), dir: 'desc' });
        } else {
          this._sorts.push({ field: p, dir: 'asc' });
        }
      }
    } else if (typeof sortParam === 'object' && sortParam !== null) {
      for (const [k, v] of Object.entries(sortParam)) {
        const dir = (v === -1 || v === 'desc' || v === '-1') ? 'desc' : 'asc';
        this._sorts.push({ field: k, dir });
      }
    }
    return this;
  }

  limit(num) {
    this._limit = Number(num);
    return this;
  }

  async exec() {
    const col = this.collectionRef;

    // Handle direct ID lookup
    if (this.filter && (this.filter._id !== undefined || this.filter.id !== undefined)) {
      const targetId = String(this.filter._id || this.filter.id);
      const docSnap = await col.doc(targetId).get();
      if (!docSnap.exists) {
        return this._isFindOne ? null : [];
      }
      const obj = docToObject(docSnap);
      this._attachSave(obj);

      // Verify any additional filter conditions
      for (const [k, v] of Object.entries(this.filter)) {
        if (k !== '_id' && k !== 'id' && v !== undefined) {
          if (obj[k] !== v) {
            return this._isFindOne ? null : [];
          }
        }
      }

      const projected = this._applyProjection(obj);
      return this._isFindOne ? projected : [projected];
    }

    // Query Firestore with equality filters (without composite orderBy to avoid missing index errors)
    let query = col;
    const inMemoryFilters = {};

    for (const [key, val] of Object.entries(this.filter)) {
      if (key === 'isActive' && val === true) {
        // Handle isActive in memory so documents where isActive is undefined or true both match
        inMemoryFilters[key] = val;
      } else if (val !== undefined) {
        query = query.where(key, '==', val);
      }
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map(doc => {
      const obj = docToObject(doc);
      this._attachSave(obj);
      return obj;
    });

    // Apply in-memory equality checks (e.g. isActive !== false)
    if (Object.keys(inMemoryFilters).length > 0) {
      results = results.filter(obj => {
        if (inMemoryFilters.isActive === true) {
          return obj.isActive !== false;
        }
        return true;
      });
    }

    // In-memory multi-field sorting
    if (this._sorts.length > 0 && results.length > 1) {
      results.sort((a, b) => {
        for (const { field, dir } of this._sorts) {
          const valA = a[field];
          const valB = b[field];
          if (valA === undefined && valB === undefined) continue;
          if (valA === undefined) return 1;
          if (valB === undefined) return -1;
          const mult = dir === 'desc' ? -1 : 1;
          if (valA < valB) return -1 * mult;
          if (valA > valB) return 1 * mult;
        }
        return 0;
      });
    }

    // In-memory limit
    if (this._limit && Number.isFinite(this._limit)) {
      results = results.slice(0, this._limit);
    }

    results = results.map((obj) => this._applyProjection(obj));

    if (this._isFindOne) {
      return results.length > 0 ? results[0] : null;
    }

    return results;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  _attachSave(obj) {
    if (!obj) return;
    const collectionRef = this.collectionRef;
    obj.save = async function () {
      const id = this._id || this.id;
      const dataToSave = { ...this };
      delete dataToSave._id;
      delete dataToSave.id;
      delete dataToSave.save;
      delete dataToSave.toObject;
      delete dataToSave.toJSON;
      delete dataToSave.select;
      dataToSave.updatedAt = new Date().toISOString();
      await collectionRef.doc(id).set(dataToSave, { merge: true });
      return this;
    };
  }

  _applyProjection(obj) {
    if (!obj || !this._selectFields?.length) return obj;

    const exclusions = this._selectFields
      .filter((field) => field.startsWith('-'))
      .map((field) => field.slice(1));
    const inclusions = this._selectFields
      .filter((field) => !field.startsWith('-') && !field.startsWith('+'));

    let projected;
    if (inclusions.length > 0) {
      projected = {};
      for (const field of inclusions) {
        if (Object.prototype.hasOwnProperty.call(obj, field)) {
          projected[field] = obj[field];
        }
      }
      if (!exclusions.includes('_id') && obj._id !== undefined) {
        projected._id = obj._id;
      }
      if (obj.id !== undefined) projected.id = obj.id;
      for (const method of ['toObject', 'toJSON', 'select', 'save']) {
        if (typeof obj[method] === 'function') projected[method] = obj[method];
      }
    } else {
      projected = { ...obj };
    }

    for (const field of exclusions) delete projected[field];
    return projected;
  }
}

// Factory to create a Mongoose-compatible model backed by Firestore
const createFirestoreModel = (collectionName) => {
  const getCol = () => getDb().collection(collectionName);

  const Model = {
    collectionName,

    async create(data) {
      const col = getCol();
      const docRef = (data._id || data.id) ? col.doc(String(data._id || data.id)) : col.doc();
      const id = docRef.id;

      const toSave = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete toSave._id;
      delete toSave.id;

      await docRef.set(toSave);
      const savedDoc = await docRef.get();
      const obj = docToObject(savedDoc);
      this._attachSave(obj);
      return obj;
    },

    async insertMany(docs) {
      const results = [];
      for (const d of docs) {
        const item = await this.create(d);
        results.push(item);
      }
      return results;
    },

    findOne(query = {}) {
      return new QueryBuilder(getCol(), query).findOne();
    },

    find(query = {}) {
      return new QueryBuilder(getCol(), query);
    },

    findById(id) {
      return new QueryBuilder(getCol(), { _id: id }).findOne();
    },

    async findByIdAndUpdate(id, update, options = {}) {
      if (!id) return null;
      const docRef = getCol().doc(String(id));
      const existing = await docRef.get();
      if (!existing.exists) return null;

      let cleanUpdate = {};
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          cleanUpdate[k] = (existing.data()[k] || 0) + v;
        }
      }
      for (const [k, v] of Object.entries(update)) {
        if (!k.startsWith('$')) {
          cleanUpdate[k] = v;
        }
      }

      cleanUpdate.updatedAt = new Date().toISOString();
      await docRef.set(cleanUpdate, { merge: true });

      const updatedDoc = await docRef.get();
      const obj = docToObject(updatedDoc);
      this._attachSave(obj);
      if (obj) {
        obj.select = function () { return this; };
      }
      return obj;
    },

    async findOneAndUpdate(query, update, options = {}) {
      const target = await this.findOne(query);
      if (!target) return null;
      return this.findByIdAndUpdate(target._id, update, options);
    },

    async deleteOne(query) {
      const target = await this.findOne(query);
      if (target) {
        await getCol().doc(target._id).delete();
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },

    async deleteMany(query = {}) {
      const col = getCol();
      let q = col;
      for (const [k, v] of Object.entries(query)) {
        q = q.where(k, '==', v);
      }
      const snapshot = await q.get();
      const batch = getDb().batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return { deletedCount: snapshot.docs.length };
    },

    async estimatedDocumentCount() {
      const snapshot = await getCol().limit(1).get();
      return snapshot.empty ? 0 : 1;
    },

    async countDocuments(query = {}) {
      let q = getCol();
      for (const [k, v] of Object.entries(query)) {
        q = q.where(k, '==', v);
      }
      const snapshot = await q.get();
      return snapshot.docs.length;
    },

    _attachSave(obj) {
      if (!obj) return;
      const col = getCol();
      obj.save = async function () {
        const id = this._id || this.id;
        const dataToSave = { ...this };
        delete dataToSave._id;
        delete dataToSave.id;
        delete dataToSave.save;
        delete dataToSave.toObject;
        delete dataToSave.toJSON;
        delete dataToSave.select;
        dataToSave.updatedAt = new Date().toISOString();
        await col.doc(id).set(dataToSave, { merge: true });
        return this;
      };
    }
  };

  return Model;
};

module.exports = {
  createFirestoreModel,
};
