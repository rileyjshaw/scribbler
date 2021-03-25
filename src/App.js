// TODO: Add a toggle for each between cartesian and polar.
//       that way, spiral would be just straight line in polar.
import React, { useCallback, useMemo, useState } from 'react';
import './App.css';

const INFINITE_LOOP_PREVENTION_LIMIT = 10000;
const OUT_OF_BOUNDS_STREAK_LIMIT = 500;

const {cos, sin, PI, floor, random} = Math;

const coordTypes = [
  {
    name: 'cartesian',
    convert: (x, y) => [x, y],
  },
  {
    name: 'polar',
    convert: (θ, r) => [r * cos(θ), r * sin(θ)],
  },
];

const adjustTime = fn => (speed, offset, cutoff) => {
  // TODO: Figure out the default value of cutoff.
  if (speed === 1 && offset === 0 && typeof cutoff !== 'number') return fn;
  return t => {
    const result = t * speed + offset;
    return result > cutoff ? false : fn(result);
  };
};

const lineTypesEventually = [
  {
    name: 'point',
    draw: convert => (x, y) => adjustTime(_ => convert(x, y)),
    defaults: [0, 0],
    zoom: 3,
  },
  {
    name: 'line',
    draw: convert => (angle) => {
      const θ = angle / 180 * PI;
      return adjustTime(t => convert(cos(θ) * t, sin(θ) * t));
    },
    defaults: [45],
  },
  {
    name: 'spiral',
    draw: convert => (density, x0, y0) => adjustTime(t => {
      const coefficient = t * density;
      return convert(cos(t) * coefficient, sin(t) * coefficient);
    }),
    defaults: [1, 0, 0],
  },
  {
    name: 'sin',
    draw: convert => (period, amplitude, phaseShift, offset) => adjustTime(t => convert(t, offset + amplitude * sin(1 / period * (t + phaseShift)))),
    defaults: [10, 10, 0, 0],
  },
  {
    name: 'walker',
    draw: convert => scale => {
      let x = 0;
      let y = 0;
      return adjustTime(t => {
        x += floor(random() * 3) - 1;
        y += floor(random() * 3) - 1;
        return convert(x * scale, y * scale);
      });
    },
    defaults: [1],
  }
];

// HACK: Just for testing. Eventually rename lineTypesEventually to lineTypes.
const lineTypes = [];
lineTypesEventually.forEach(lineType => coordTypes.forEach(coordType => {
  lineTypes.push({
    name: `${lineType.name}-${coordType.name}`,
    draw: lineType.draw(coordType.convert),
    defaults: lineType.defaults,
  });
}));

const ScribblePad = React.memo(function ScribblePad({w, h, formula, scale = 1, ...rest}) {
  const setRef = useCallback((canvas) => {
    if (!canvas) return;
    const xMax = w / 2;
    const yMax = h / 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.transform(1, 0, 0, -1, xMax, yMax);
    for (let t = 0, outOfBoundsStreak = 0, prevCoords = [0, 0]; t < INFINITE_LOOP_PREVENTION_LIMIT; t += 1) {
      const coords = formula(t);
      if (coords === false) break;
      const x = coords[0] * scale;
      const y = coords[1] * scale;
      if (x > -xMax && y > -yMax && x < xMax && y < yMax) {
        if (outOfBoundsStreak) {
          outOfBoundsStreak = 0;
          ctx.moveTo(...prevCoords);
        }
        ctx[t ? 'lineTo' : 'moveTo'](x, y);
      } else {
        // if (!outOfBoundsStreak) { /* Handle intersection. */}
        if (++outOfBoundsStreak >= OUT_OF_BOUNDS_STREAK_LIMIT) break;
      }
      prevCoords = [x, y];
    }
    ctx.stroke();
    ctx.restore();
  }, [w, h, formula, scale]);

  return (
    <canvas width={w} height={h} ref={setRef} {...rest} />
  )
});

function App() {
  const [lines, setLines] = useState([]);
  const fullDraw = useMemo(() => {
    const fns = lines.map(line => line.draw(...line.parameters)(...line.timeAdjustments));
    const lastCoords = Array.from(fns, () => [0, 0]);
    return t => fns.reduce((acc, fn, i) => {
      let coords = fn(t);
      if (Array.isArray(coords)) {
        lastCoords[i] = coords;
      } else coords = lastCoords[i];
      acc[0] += coords[0];
      acc[1] += coords[1];
      return acc;
    }, [0, 0]);
  }, [lines]);

  return (
    <div className="App">
      <ul className="add-line">
        {lineTypes.map(({name, draw, defaults, zoom = 0.5}) => <li key={name}>
          <button
            key={name}
            onClick={() => {
              setLines(oldLines => [
                ...oldLines,
                {
                  draw,
                  parameters: [...defaults],
                  timeAdjustments: [1, 0, 1000],
                },
              ]);
            }}
          >
            <ScribblePad
              w={60}
              h={60}
              formula={draw(...defaults)(1, 0)}
              scale={zoom}
            />
          </button>
        </li>)}
      </ul>
      <ul className="line-list">
        {lines.map(({draw, parameters, timeAdjustments}, i) => <li key={i}>
          <ScribblePad w={60} h={60} formula={draw(...parameters)(...timeAdjustments)} scale={0.5} onClick={
            () => setLines(lines => [...lines.slice(0, i), ...lines.slice(i + 1)])
          } />
          {timeAdjustments.map((value, j) => <input
            key={j}
            type="number"
            value={Number(value)}
            onChange={e => setLines(lines => {
              const newLines = [...lines];
              newLines[i].timeAdjustments[j] = Number(e.target.value);
              return newLines;
            })}
          />)}
          {parameters.map((parameter, j) => <input
            key={j}
            type="number"
            value={parameter}
            onChange={e => setLines(lines => {
              const newLines = [...lines];
              newLines[i].parameters[j] = Number(e.target.value);
              return newLines;
            })}
          />)}
        </li>)}
      </ul>
      <ScribblePad
        className="output"
        w={600}
        h={600}
        formula={fullDraw}
      />
    </div>
  );
}

export default App;
