import CoffeeCupIcon from '../components/CoffeeCupIcon';

export default function CoffeePage() {
  return (
    <div>
      <h1 className="section-title"><CoffeeCupIcon size={22} /> Coffee Corner</h1>
      <div className="card coffee-card">
        <CoffeeCupIcon size={56} style={{ marginBottom: 16 }} />
        <p className="coffee-message">covers.cafe runs on coffee.</p>
        <p className="coffee-sub">
          If you love what we're building, you can buy us a coffee and help keep the lights on.
        </p>
        <a
          href="https://buymeacoffee.com/covers.cafe"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary coffee-btn"
        >
          <CoffeeCupIcon size={15} /> Buy us a coffee
        </a>
      </div>
      
    </div>
  );
}
