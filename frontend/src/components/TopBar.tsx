type TopBarProps = {
  username: string;
};

const TopBar = ({ username }: TopBarProps) => {
  return (
    <header className="top-bar">
      <div>
        <span className="eyebrow">Signed in as</span>
        <strong>{username || "guest"}</strong>
      </div>
      <div className="badge">Today</div>
    </header>
  );
};

export default TopBar;
