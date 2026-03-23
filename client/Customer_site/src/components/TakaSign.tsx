// Responsive currency sign: "Tk" on desktop, "৳" on mobile — always bold
const TakaSign = () => (
  <>
    <span className="hidden sm:inline font-bold">Tk</span>
    <span className="inline sm:hidden font-bold">৳</span>
  </>
);

// For use inside template literals / string contexts (e.g. button labels)
// Returns "Tk" on desktop via CSS is not possible in strings, so we use ৳ as fallback
// Use <TakaSign /> in JSX wherever possible instead
export const takaSign = "৳";

export default TakaSign;
