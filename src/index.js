import m from 'mithril';
import ClipperLib from 'clipper-lib';


require('./style.css');

const genCirclePoints = (n, cx, cy, r) => new Array(n).fill(0).map((value, i) => ({
  x: cx + Math.cos(i / n * 6.283) * r,
  y: cy + Math.sin(i / n * 6.283) * r,
}));

const genSVGPath = (points) => points.map(({x, y}, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ') + 'Z';  // eslint-disable-line
const pointsToClipper = (points) => points.map(({x, y}) => ({X: x, Y: y}));
const clipperToPoints = (clipperPoints) => clipperPoints.map(({X, Y}) => ({x: X, y: Y}));
const getPointsBounds = (points) => {
  let minX;
  let maxX;
  let minY;
  let maxY;
  points.forEach(({x, y}) => {
    if (minX === undefined || x < minX) minX = x;
    if (minY === undefined || y < minY) minY = y;
    if (maxX === undefined || x > maxX) maxX = x;
    if (maxY === undefined || y > maxY) maxY = y;
  });
  return {minX, maxX, minY, maxY, width: Math.abs(maxX - minX), height: Math.abs(maxY - minY)};
};

const genPathTransform = (path) => {
  const bits = [];
  if (path.x !== undefined && path.y !== undefined) {
    bits.push(`translate(${path.x.toFixed(3)} ${path.y.toFixed(3)})`);
  }
  if (path.r !== undefined) {
    if (path.width !== undefined && path.height !== undefined) {
      const midX = (path.width / 2);
      const midY = (path.height / 2);
      bits.push(`rotate(${path.r.toFixed(3)} ${midX.toFixed(3)} ${midY.toFixed(3)})`);
    } else {
      bits.push(`rotate(${path.r.toFixed(3)})`);
    }
  }
  return bits.join(' ');
};

const paths = [];

const fracturePath = (path, event) => {
  const svg = event.target.ownerSVGElement;
  const pt = Object.assign(svg.createSVGPoint(), {x: event.clientX, y: event.clientY});
  const cursorPt = pt.matrixTransform(event.target.getScreenCTM().inverse());
  let direction = Math.random() * 6.283;
  const origDirection = direction;
  const fractureClip = [];
  const n = 40;
  const jag = 0.07;
  const farPoint = {
    x: cursorPt.x + Math.cos(origDirection + Math.PI / 2) * 10000,
    y: cursorPt.y + Math.sin(origDirection + Math.PI / 2) * 10000,
  };
  for (let i = -n; i < n; i++) {
    const dist = 700 * (i / n);
    direction += -jag + Math.random() * jag * 2;
    fractureClip.push({
      x: cursorPt.x + Math.cos(direction) * dist,
      y: cursorPt.y + Math.sin(direction) * dist,
    });
  }
  fractureClip.unshift(farPoint);
  fractureClip.push(farPoint);
  // paths.push({fill: 'rgba(60, 60, 60, 0.3)', points: fractureClip});
  const differenceResult = new ClipperLib.Paths();
  const intersectionResult = new ClipperLib.Paths();
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths([pointsToClipper(path.points)], ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths([pointsToClipper(fractureClip)], ClipperLib.PolyType.ptClip, true);
  clipper.Execute(ClipperLib.ClipType.ctDifference, differenceResult);
  clipper.Execute(ClipperLib.ClipType.ctIntersection, intersectionResult);

  paths.splice(paths.indexOf(path), 1);
  [].concat(differenceResult).concat(intersectionResult).map((clipperPoints, i) => {
    let points = clipperToPoints(clipperPoints);
    const {width, height} = getPointsBounds(points);
    paths.push({
      fractured: true,
      x: path.x || 0,
      y: path.y || 0,
      //r: path.r || 0,
      hue: path.hue - (5 + Math.random() * 10),
      dx: -0.5 + Math.random(),
      dy: -0.5 + Math.random(),
      //dr: -0.5 + Math.random(),
      fill: 'blue',
      points,
      width,
      height,
    })
    ;
  });
};

const breakEverything = () => {
  [].concat(paths).filter((path) => path.dom).forEach((path) => {
    const x = Math.random() * 800;
    const y = Math.random() * 800;
    const event = {target: path.dom, clientX: x, clientY: y};
    fracturePath(path, event);
  });
};

paths.push({hue: Math.random() * 360, x: 0, y: 0, points: genCirclePoints(30, 400, 400, 300)});

setInterval(() => {
  paths.forEach((path) => {
    if (path.fractured) {
      path.x += path.dx;
      path.y += path.dy;
      path.dx *= 0.97;
      path.dy *= 0.97;
      //path.r += path.dr;
      //path.dr *= 0.97;
    }
  });
  m.redraw();
}, 16);

m.mount(document.body, {
  view() {
    const svg = m(
      'svg',
      {width: 800, height: 800, style: 'cursor: pointer'},
      paths.map(
        (path) => m('path',
          {
            oncreate: (vnode) => {
              path.dom = vnode.dom;
            },
            onupdate: (vnode) => {
              path.dom = vnode.dom;
            },
            d: genSVGPath(path.points),
            fill: (path.hue !== undefined ? `hsl(${path.hue}, 100%, 40%)` : path.fill || 'blue'),
            opacity: 0.9,
            stroke: 'white',
            strokeWidth: 2,
            transform: genPathTransform(path),
            onclick: (event) => fracturePath(path, event),
          },
        )
      )
    );
    return m('div', [
      svg,
      m('div', [
        'Click on pieces to break them or ',
        m('a', {href: '#', onclick: breakEverything}, 'break all the things...')
      ]),
    ]);
  },
});
