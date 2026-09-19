import Avatar from '@/Components/Avatar';
import { formatDateTime } from '@/lib/dates';

// The conversation on a ticket. Messages from the viewer's own side sit on the
// right, like the chat page, so it is clear at a glance who said what.
export default function SupportThread({ thread, viewerIsStaff }) {
    return (
        <ul className="space-y-4">
            {thread.map((message) => {
                const mine = message.from_staff === viewerIsStaff;

                return (
                    <li
                        key={message.id}
                        className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                        {!mine && <Avatar src={message.avatar_url} name={message.author} size="sm" />}
                        <div
                            className={`max-w-xl rounded-lg px-4 py-3 ${
                                mine
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white shadow dark:bg-gray-800'
                            }`}
                        >
                            <div className={`mb-1 text-xs ${mine ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {message.author} · {formatDateTime(message.created_at)}
                            </div>
                            {/* whitespace-pre-line keeps the writer's line breaks; React escapes the text itself. */}
                            <p className="whitespace-pre-line break-words text-sm">{message.body}</p>
                        </div>
                        {mine && <Avatar src={message.avatar_url} name={message.author} size="sm" />}
                    </li>
                );
            })}
        </ul>
    );
}
