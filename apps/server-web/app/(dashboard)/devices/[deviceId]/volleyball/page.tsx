import SportControlPage from '../SportControlPage';

export default async function VolleyballPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  return (
    <SportControlPage
      deviceId={deviceId}
      config={{
        sport: 'volleyball',
        title: 'Volleyball Controls',
        clockLabel: 'Match Clock',
        periodLabel: 'Set',
        homeLabel: 'Home',
        awayLabel: 'Away',
        showSets: true,
      }}
    />
  );
}
