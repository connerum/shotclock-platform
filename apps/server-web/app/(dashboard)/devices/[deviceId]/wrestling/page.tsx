import SportControlPage from '../SportControlPage';

export default function WrestlingPage({ params }: { params: { deviceId: string } }) {
  return (
    <SportControlPage
      deviceId={params.deviceId}
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
