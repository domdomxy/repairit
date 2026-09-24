import Avatar from '@/Components/Avatar';

// Three dots bouncing in sequence, in a bubble the same shape as an incoming
// message. Shown only while a whisper keeps saying the other person is
// still typing (see Show.jsx); it never touches the database.
export default function TypingIndicator({ author, bubbleClassName = 'rounded-lg bg-gray-100 dark:bg-gray-700' }) {
    return (
        <div className="flex items-end gap-2">
            <Avatar user={author} size="sm" />
            <div className={`flex items-center gap-1 px-4 py-3 ${bubbleClassName}`}>
                {[0, 150, 300].map((delay) => (
                    <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500"
                        style={{ animationDelay: `${delay}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}
