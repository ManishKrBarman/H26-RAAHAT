function Intersection({ activeLane }) {
  const lanes = ["A", "B", "C", "D"];

  const getColor = (lane) => {
    return lane === activeLane ? "green" : "red";
  };

  return (
    <div className="intersection">

      <div className="lane">
        <div className={`light ${getColor("A")}`}></div>
        <p>A - {activeLane === "A" ? "ACTIVE" : "WAITING"}</p>
      </div>

      <div className="middle-row">
        <div className="lane">
          <div className={`light ${getColor("B")}`}></div>
          <p>B - {activeLane === "B" ? "ACTIVE" : "WAITING"}</p>
        </div>

        <div className="center">+</div>

        <div className="lane">
          <div className={`light ${getColor("C")}`}></div>
          <p>C - {activeLane === "C" ? "ACTIVE" : "WAITING"}</p>
        </div>
      </div>

      <div className="lane">
        <div className={`light ${getColor("D")}`}></div>
        <p>D - {activeLane === "D" ? "ACTIVE" : "WAITING"}</p>
      </div>

    </div>
  );
}

export default Intersection;