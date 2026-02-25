import { useNavigate } from 'react-router-dom';
import DiscIcon from '../components/DiscIcon';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <div className="not-found-icon"><DiscIcon size={52} /></div>
        <h1 className="not-found-code">404</h1>
        <p className="not-found-headline">This record doesn't exist.</p>
        <p className="not-found-sub">
          The page you're looking for has been moved, deleted, or never pressed in the first place.
        </p>
        <button className="btn not-found-btn" onClick={() => navigate('/')}>
          Back to Gallery
        </button>
      </div>

      
    </div>
  );
}
