const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const game = {
    timestamp: undefined,
    accum: 0
};

const assets = {
    ships: new Image(),
    tiles: new Image(),
    map: new Image()
};

const ships = [
    { x: 0, y: 0, rotation: 0 }
];

const input = {};

assets.ships.src = "assets/ships.png";
assets.tiles.src = "assets/tiles.png";
assets.map.src = "assets/map.png";

function step(deltatime) {
    const x = (input["ArrowRight"] || 0.0) - (input["ArrowLeft"] || 0.0);
    const y = (input["ArrowDown"] || 0.0) - (input["ArrowUp"] || 0.0);

    const ship = ships[0];
    ship.x -= Math.sin(ship.rotation) * y * deltatime * 16.0;
    ship.y += Math.cos(ship.rotation) * y * deltatime * 16.0;
    ship.rotation += x * deltatime * Math.PI;
}

function render() {
    ctx.resetTransform();
    //ctx.fillStyle = "black";
    //ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(2, 2);
    ctx.fillStyle = ctx.createPattern(assets.map, "repeat");
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.resetTransform();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    ctx.scale(32, 32);

    for (let i = 0; i < ships.length; i++) {
        const ship = ships[i];

        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.rotation);
        ctx.translate(-1.0, -1.0);
        ctx.drawImage(assets.ships, 0, 0, 32, 32, 0, 0, 2, 2);
        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
}

function gameloop(timestamp) {
    if (game.timestamp !== undefined) {
        const deltatime = timestamp - game.timestamp;
        step(deltatime / 1000.0);

        /*game.accum = Math.min(game.accum + deltatime, 100.0);
        while (game.accum >= 1000.0 / 60.0) {
            step(1.0 / 60.0);
            game.accum -= 1000.0 / 60.0;
        }*/
    }
    game.timestamp = timestamp;

    render();
    requestAnimationFrame(gameloop);
}

window.addEventListener("keydown", (e) => { input[e.key] = true; });
window.addEventListener("keyup", (e) => { input[e.key] = false; });

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
    resizeCanvas();
    requestAnimationFrame(gameloop);
});
