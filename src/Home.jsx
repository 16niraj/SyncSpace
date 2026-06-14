import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Generate a quick random ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomId = '';
    for (let i = 0; i < 6; i++) {
      randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Redirect instantly to this room
    navigate(`/room/${randomId}`);
  }, [navigate]);

  return <div className="min-h-screen bg-[#FAFAFA]" />; // Blank screen during redirect
}