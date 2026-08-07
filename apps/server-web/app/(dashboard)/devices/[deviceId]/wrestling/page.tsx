import SportControlPage from '../SportControlPage';

export default async function WrestlingPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  return (
    <SportControlPage
      deviceId={deviceId}
      config={{
        sport: 'wrestling',
        title: 'Wrestling Controls',
        clockLabel: 'Match Clock',
        periodLabel: 'Period',
        homeLabel: 'Red',
        awayLabel: 'Green',
      }}
    />
  );
}
