import MessagesShell from '@/Components/MessagesShell';

export default function Index({ conversations }) {
    return <MessagesShell conversations={conversations} />;
}
