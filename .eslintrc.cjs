module.exports = {
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 12, sourceType: 'module' },
  plugins: ['react'],
  rules: {
    'no-empty': 'off',
    'no-unused-vars': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-unreachable': 'off',
    'no-prototype-builtins': 'off',
    'no-undef': 'off',
    'no-constant-condition': 'off',
    'no-cond-assign': 'off',
    'no-useless-escape': 'off',
    'no-misleading-character-class': 'off',
    'no-control-regex': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off'
  },
  settings: { react: { version: 'detect' } }
};
