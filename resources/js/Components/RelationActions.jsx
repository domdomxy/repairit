import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { router } from '@inertiajs/react';
import { useState } from 'react';

// Favorite, mute, restrict and block, and undoing each. What they do is
// explained under each name, because "restrict" in particular is not obvious.
// Nothing here is ever shown to the other person.
const ACTIONS = [
    {
        relation: 'favorite',
        flag: 'favorited',
        on: 'Remove from favorites',
        off: 'Add to favorites',
        hint: 'Keeps them at the top of your messages and lets you find them with "favorites" in the search.',
    },
    {
        relation: 'mute',
        flag: 'muted',
        on: 'Unmute',
        off: 'Mute',
        hint: 'Their messages still arrive, without notifications, emails or an unread badge.',
    },
    {
        relation: 'restrict',
        flag: 'restricted',
        on: 'Unrestrict',
        off: 'Restrict',
        hint: 'Their messages wait in Requests without notifying you, and no automatic reply is sent to them.',
    },
    {
        relation: 'block',
        flag: 'blocked',
        on: 'Unblock',
        off: 'Block',
        hint: 'Neither of you can message the other, send quotes or review each other, and you disappear from each other\u2019s search, feed and profile.',
        danger: true,
    },
];

// `person` is { id, name }; `relations` what the signed-in person already did
// about them: { blocked, muted, favorited, restricted }. With `collapsible`
// the list sits behind a "More options" line, for pages where it is a side note.
export default function RelationActions({ person, relations, collapsible = false }) {
    const [confirmingBlock, setConfirmingBlock] = useState(false);
    const [processing, setProcessing] = useState(false);

    if (!relations) return null;

    function apply(relation, currently) {
        const options = {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setConfirmingBlock(false);
            },
        };
        const url = route(currently ? 'relations.destroy' : 'relations.store', { user: person.id, relation });

        if (currently) router.delete(url, options);
        else router.post(url, {}, options);
    }

    function choose(action) {
        const currently = relations[action.flag];

        // Blocking has the most consequences, so it is confirmed first; undoing it is not.
        if (action.relation === 'block' && !currently) {
            setConfirmingBlock(true);
            return;
        }

        apply(action.relation, currently);
    }

    // A blocked person can't be a favorite.
    const visible = ACTIONS.filter((action) => !(action.relation === 'favorite' && relations.blocked));

    const list = (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {visible.map((action) => {
                const currently = relations[action.flag];

                return (
                    <li key={action.relation}>
                        <button
                            type="button"
                            onClick={() => choose(action)}
                            disabled={processing}
                            className="w-full py-2.5 text-start disabled:opacity-60"
                        >
                            <span
                                className={`block text-sm font-medium ${
                                    action.danger
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-800 dark:text-gray-100'
                                }`}
                            >
                                {currently ? action.on : action.off}
                            </span>
                            {!currently && (
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                    {action.hint}
                                </span>
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );

    return (
        <>
            {collapsible ? (
                <details className="mt-4 rounded-lg border border-gray-100 px-3 dark:border-gray-700">
                    <summary className="cursor-pointer select-none py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                        More options
                        {(relations.blocked || relations.muted || relations.restricted || relations.favorited) && (
                            <span className="ms-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                {[
                                    relations.favorited && 'Favorite',
                                    relations.muted && 'Muted',
                                    relations.restricted && 'Restricted',
                                    relations.blocked && 'Blocked',
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        )}
                    </summary>
                    {list}
                </details>
            ) : (
                list
            )}

            <Modal show={confirmingBlock} onClose={() => setConfirmingBlock(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Block {person.name}?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Neither of you will be able to send messages, quotes or reviews to the other, and you will
                        disappear from each other&rsquo;s search, feed and profile. Your conversation stays readable.
                        {' '}{person.name} is not told, and you can unblock them at any time.
                    </p>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirmingBlock(false)}>Cancel</SecondaryButton>
                        <DangerButton onClick={() => apply('block', false)} disabled={processing}>
                            Block {person.name}
                        </DangerButton>
                    </div>
                </div>
            </Modal>
        </>
    );
}
