const Loader = ({ text = 'Loading...' }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3">
    <div className="w-9 h-9 border-3 border-stone-200 border-t-brand-700 rounded-full animate-spin" />
    <p className="text-xs text-stone-600 font-medium tracking-wide">{text}</p>
  </div>
)
export default Loader
