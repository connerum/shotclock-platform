import SportControlPage from '../SportControlPage';

export default function VolleyballPage({ params }: { params: { deviceId: string } }) {
  return (
    <SportControlPage
      deviceId={params.deviceId}
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
