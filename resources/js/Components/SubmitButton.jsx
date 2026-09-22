// The button that saves a post form (a request or an offer): indigo like the
// buttons that open the form, where PrimaryButton is the neutral dark one.
export default function SubmitButton({ className = '', disabled, children, ...props }) {
    return (
        <button
            {...props}
            type="submit"
            disabled={disabled}
            className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-sm transition duration-150 ease-in-out hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-800 ${className}`}
        >
            {children}
        </button>
    );
}
