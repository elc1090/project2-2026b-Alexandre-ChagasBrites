"use client";

import { useEffect } from "react";
import { FirebaseApp, initializeApp } from "firebase/app";
import { Database, DatabaseReference, Unsubscribe, getDatabase, ref, set, get, update, push, remove, onValue, onChildAdded, onChildRemoved, onDisconnect } from "firebase/database";

type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

const enum ObjectType {
    None,
    Ship,
    Explosion,
    Munition,
    Enemy
};

const enum ObjectOwnership {
    None,
    Local,
    Remote
};

type Object = {
    alive: boolean;
    type: ObjectType;
    ownership: ObjectOwnership;
    ref: DatabaseReference | null;
    x: number;
    y: number;
    rotation: number;
    velocity: number;
    clientX: number;
    clientY: number;
    clientRotation: number;
    clientVelocity: number;
    serverX: number;
    serverY: number;
    serverRotation: number;
    serverVelocity: number;
    texture: HTMLImageElement;
    textureRegion: Rect;
    shootTime: number;
    updateTime: number;
    blendTime: number;
    blendFactor: number;
    onValueUnsubscribe: Unsubscribe | null;
};

type Assets = {
    ships: HTMLImageElement;
    tiles: HTMLImageElement;
    map: HTMLImageElement;
    regions: HTMLImageElement;
};

type Game = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    requestId: number;
    timestamp: DOMHighResTimeStamp | undefined;
    accum: number;
    input: any;
    
    assets: Assets;
    objects: Object[];
    objectsChanged: boolean;
    cameraX: number;
    cameraY: number;
    score: number;
    maxScore: number;
    serverScore: number | null;

    player: Object | null;
    enemyCount: number;
    scoreTime: number;
    spawnTime: number;

    app: FirebaseApp;
    db: Database;
    offsetVal: number;
    scoreRef: DatabaseReference | null;
};

export default function Canvas() {

    useEffect(() => {
        const canvas = document.querySelector("canvas");
        if (canvas === null) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (ctx === null) {
            return;
        }

        const firebaseConfig = {
            apiKey: "AIzaSyAF7df33ABVrRoHnyXeRAkAqHchsMSDSzk",
            authDomain: "pixel-shmup.firebaseapp.com",
            projectId: "pixel-shmup",
            storageBucket: "pixel-shmup.firebasestorage.app",
            messagingSenderId: "226791231751",
            appId: "1:226791231751:web:cb34c8d4d9478c0a2735a2"
        };
        const app = initializeApp(firebaseConfig);

        const game: Game = {
            canvas: canvas,
            ctx: ctx,

            requestId: 0,
            timestamp: undefined,
            accum: 0.0,
            input: {},
            
            assets: {
                ships: new Image(),
                tiles: new Image(),
                map: new Image(),
                regions: new Image()
            },
            objects: [],
            objectsChanged: false,
            cameraX: 0.0,
            cameraY: 0.0,
            score: 0,
            maxScore: 0,
            serverScore: null,

            player: null,
            enemyCount: 0,
            scoreTime: 0.0,
            spawnTime: 0.0,

            app: app,
            db: getDatabase(app),
            offsetVal: 0.0,
            scoreRef: null
        };

        game.assets.ships.src = "./ships.png";
        game.assets.tiles.src = "./tiles.png";
        game.assets.map.src = "./map.png";
        game.assets.regions.src = "./regions.png";

        const onKeydown = (e: KeyboardEvent) => { game.input[e.key] = true; };
        const onKeyup = (e: KeyboardEvent) => { game.input[e.key] = false; };
        const onBlur = (e: FocusEvent) => { game.input = {}; };
        const onResize = (e: UIEvent) => { resizeCanvas(game); };
        const onAnimationFrame = (timestamp: DOMHighResTimeStamp) => {
            if (game.timestamp !== undefined) {
                const deltatime = timestamp - game.timestamp;
                onStep(game, deltatime / 1000.0);

                /*game.accum = Math.min(game.accum + deltatime, 100.0);
                while (game.accum >= 1000.0 / 60.0) {
                    onStep(1.0 / 60.0);
                    game.accum -= 1000.0 / 60.0;
                }*/
            }
            game.timestamp = timestamp;

            onRender(game);
            game.requestId = requestAnimationFrame(onAnimationFrame);
        };

        window.addEventListener("keydown", onKeydown);
        window.addEventListener("keyup", onKeyup);
        window.addEventListener("blur", onBlur);
        window.addEventListener("resize", onResize);

        resizeCanvas(game);
        game.requestId = requestAnimationFrame(onAnimationFrame);

        const offsetRef = ref(game.db, ".info/serverTimeOffset");
        const offsetRefOnValueUnsubscribe = onValue(offsetRef, (data: any) => {
            game.offsetVal = data.val() || 0.0;
        });

        game.scoreRef = ref(game.db, "maxScore");
        const scoreRefOnValueUnsubscribe = onValue(game.scoreRef, (data: any) => {
            game.serverScore = data.val() || 0.0;
        });

        const onChildAddedUnsubscribe = onChildAdded(ref(game.db, "objects"), (data: any) => {
            for (let i = 0; i < game.objects.length; i++) {
                const object = game.objects[i];
                if (object.ownership === ObjectOwnership.Local && object.ref !== null && object.ref.key === data.key) {
                    return;
                }
            }
            
            const texture = Object.values(game.assets).find(asset => asset.src === data.val().texture);
            if (texture === undefined) {
                return;
            }

            const objectRef = ref(game.db, "objects/" + data.key);
            let offsetTime = getTimediff(game, data.val().timestamp || 0.0);
            const x = data.val().serverX + Math.sin(data.val().serverRotation) * data.val().serverVelocity * offsetTime;
            const y = data.val().serverY - Math.cos(data.val().serverRotation) * data.val().serverVelocity * offsetTime;

            const object: Object = {
                alive: true,
                type: data.val().type,
                ownership: ObjectOwnership.Remote,
                ref: objectRef,
                x: x,
                y: y,
                rotation: data.val().serverRotation,
                velocity: data.val().serverVelocity,
                clientX: x,
                clientY: y,
                clientRotation: data.val().serverRotation,
                clientVelocity: data.val().serverVelocity,
                serverX: x,
                serverY: y,
                serverRotation: data.val().serverRotation,
                serverVelocity: data.val().serverVelocity,
                texture: texture,
                textureRegion: data.val().textureRegion,
                shootTime: 0.0,
                updateTime: 0.0,
                blendTime: 0.0,
                blendFactor: 1.0,
                onValueUnsubscribe: null,
            };
            addObject(game, object);

            object.onValueUnsubscribe = onValue(objectRef, (data: any) => {
                if (data.val() !== null) {
                    let offsetTime = getTimediff(game, data.val().timestamp || 0.0);
                    object.clientX = object.x;
                    object.clientY = object.y;
                    object.clientRotation = object.rotation;
                    object.clientVelocity = object.velocity;
                    object.serverRotation = data.val().serverRotation;
                    object.serverVelocity = data.val().serverVelocity;
                    object.serverX = data.val().serverX + Math.sin(object.serverRotation) * object.serverVelocity * offsetTime;
                    object.serverY = data.val().serverY - Math.cos(object.serverRotation) * object.serverVelocity * offsetTime;
                    object.blendTime = 0.0;
                    object.blendFactor = 0.0;
                }
            });
        });

        const onChildRemovedUnsubscribe = onChildRemoved(ref(game.db, "objects"), (data: any) => {
            for (let i = 0; i < game.objects.length; i++) {
                const object = game.objects[i];
                if (object.ref !== null && object.ref.key === data.key) {
                    removeObject(game, game.objects[i]);
                    return;
                }
            }
        });

        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("keyup", onKeyup);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(game.requestId);
            offsetRefOnValueUnsubscribe();
            scoreRefOnValueUnsubscribe();
            onChildAddedUnsubscribe();
            for (let i = 0; i < game.objects.length; i++) {
                const object = game.objects[i];
                if (object.ownership === ObjectOwnership.Local && object.ref !== null) {
                    remove(object.ref);
                } else if (object.ownership === ObjectOwnership.Remote && object.onValueUnsubscribe !== null) {
                    object.onValueUnsubscribe();
                }
            }
            onChildRemovedUnsubscribe();
        };
    }, []);

    return (
        <canvas></canvas>
    );
}

function onStep(game: Game, deltatime: number) {
    if (game.player !== null && game.scoreTime < 1.0) {
        game.scoreTime += deltatime / 0.1;
    } else if (game.player != null && game.scoreTime >= 1.0) {
        game.score++;
        game.scoreTime = 0.0;
    }

    if (game.spawnTime === 0.0 && game.assets.regions.complete) {
        game.spawnTime = 1.0;

        const x = Math.floor(Math.random() * game.assets.regions.width) + 0.5;
        const y = Math.floor(Math.random() * game.assets.regions.height) + 0.5;

        if (game.player === null) {
            spawnPlayer(game, x, y);
        } else if (game.enemyCount < 64) {
            game.ctx.reset();
            game.ctx.imageSmoothingEnabled = false;
            game.ctx.drawImage(game.assets.regions, x, y, 1, 1, 0, 0, 1, 1);
            
            const pixelData = game.ctx.getImageData(0, 0, 1, 1).data;
            if (pixelData[0] > 128) {
                spawnEnemy(game, x, y, 64, 32);
            } else if (pixelData[1] > 128) {
                spawnEnemy(game, x, y, 80 + Math.floor(Math.random() * 2) * 16, 32);
            }
        }
    } else if (game.spawnTime > 0.0) {
        game.spawnTime = Math.max(0.0, game.spawnTime - deltatime);
    }

    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (!object.alive) {
            continue;
        }

        if (object.type === ObjectType.Ship && object.ownership === ObjectOwnership.Local) {
            const x = (game.input["ArrowRight"] || 0.0) - (game.input["ArrowLeft"] || 0.0);
            const y = (game.input["ArrowUp"] || 0.0) - (game.input["ArrowDown"] || 0.0);

            object.velocity = clamp(object.velocity + y * deltatime * 8.0, 8.0, 32.0);
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.rotation += x * deltatime * Math.PI;

            if (object.shootTime === 0.0 && (game.input["z"] || game.input["Z"])) {
                object.shootTime = 0.1;
                spawnMunition(game, object, 64.0, 0, 0);
            } else if (object.shootTime > 0.0) {
                object.shootTime = Math.max(0.0, object.shootTime - deltatime);
            }

            if (object.ref !== null && object.updateTime === 0.0 && (object.rotation !== object.serverRotation || object.velocity !== object.serverVelocity)) {
                object.updateTime = 0.1;
                object.serverRotation = object.rotation;
                object.serverVelocity = object.velocity;
                update(object.ref, {
                    serverX: object.x, 
                    serverY: object.y,
                    serverRotation: object.rotation,
                    serverVelocity: object.velocity,
                    timestamp: getTimestamp(game)
                });
            } else if (object.updateTime > 0.0) {
                object.updateTime = Math.max(0.0, object.updateTime - deltatime);
            }
        } else if (object.type === ObjectType.Munition && object.ownership === ObjectOwnership.Local) {
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;

            for (let j = 0; j < game.objects.length; j++) {
                const otherObject = game.objects[j];
                if (!otherObject.alive || i == j) {
                    continue;
                }

                let offsetX = otherObject.x - object.x;
                let offsetY = otherObject.y - object.y;
                if (offsetX > game.assets.map.width / 32.0) { offsetX -= game.assets.map.width / 16.0; }
                if (offsetX < -game.assets.map.width / 32.0) { offsetX += game.assets.map.width / 16.0; }
                if (offsetY > game.assets.map.height / 32.0) { offsetY -= game.assets.map.height / 16.0; }
                if (offsetY < -game.assets.map.height / 32.0) { offsetY += game.assets.map.height / 16.0; }
                if (offsetX * offsetX + offsetY * offsetY > 1.0) {
                    continue;
                }
                
                if ((otherObject.type === ObjectType.Ship && otherObject.ownership === ObjectOwnership.Local) || otherObject.type === ObjectType.Enemy) {
                    removeObject(game, object);
                    removeObject(game, otherObject);
                    spawnExplosion(game, otherObject.x, otherObject.y);
                    if (otherObject.type === ObjectType.Enemy && game.player !== null) {
                        game.score += 100;
                    }
                }
            }

            object.shootTime += deltatime;
            if (object.shootTime >= 1.0) {
                removeObject(game, object);
            }
        } else if (object.type === ObjectType.Enemy) {
            if (game.player !== null) {
                let offsetX = game.player.x - object.x;
                let offsetY = game.player.y - object.y;

                if (offsetX > game.assets.map.width / 32.0) { offsetX -= game.assets.map.width / 16.0; }
                if (offsetX < -game.assets.map.width / 32.0) { offsetX += game.assets.map.width / 16.0; }
                if (offsetY > game.assets.map.height / 32.0) { offsetY -= game.assets.map.height / 16.0; }
                if (offsetY < -game.assets.map.height / 32.0) { offsetY += game.assets.map.height / 16.0; }

                if (offsetX * offsetX + offsetY * offsetY < 25.0 * 25.0) {
                    const rotation = Math.atan2(offsetY, offsetX) + Math.PI * 0.5;
                    const offsetRotation = boundedDiff(object.rotation, rotation, -Math.PI, Math.PI);
                    object.rotation += clamp(offsetRotation, -Math.PI * 0.5 * deltatime, Math.PI * 0.5 * deltatime);
                    if (Math.abs(offsetRotation) < Math.PI * 0.1) {
                        object.shootTime += deltatime;
                        if (object.shootTime >= 1.5) {
                            object.shootTime = 0.0;
                            spawnMunition(game, object, 32.0, 32, 0);
                        }
                    } else {
                        object.shootTime = Math.max(0.0, object.shootTime - deltatime);
                    }
                } else {
                    object.shootTime = Math.max(0.0, object.shootTime - deltatime);
                }
            }
        } else if (object.type === ObjectType.Explosion) {
            object.shootTime += deltatime / 0.3;
            if (object.shootTime >= 0.33 && object.shootTime < 0.66) {
                object.textureRegion.x = 112;
            } else if (object.shootTime >= 0.66 && object.shootTime < 1.0) {
                object.textureRegion.x = 128;
            } else if (object.shootTime >= 1.0) {
                removeObject(game, object);
            }
        } else if (object.ownership === ObjectOwnership.Remote) {
            if (object.blendFactor < 1.0) {
                object.blendTime += deltatime;
                object.blendFactor = Math.min(object.blendFactor + deltatime / 0.2, 1.0);
                object.rotation = boundedLerp(object.clientRotation, object.serverRotation, object.blendFactor, -Math.PI, Math.PI);
                object.velocity = lerp(object.clientVelocity, object.serverVelocity, object.blendFactor);
                const clientX = object.clientX + Math.sin(object.rotation) * object.velocity * object.blendTime;
                const clientY = object.clientY - Math.cos(object.rotation) * object.velocity * object.blendTime;
                const serverX = object.serverX + Math.sin(object.serverRotation) * object.serverVelocity * object.blendTime;
                const serverY = object.serverY - Math.cos(object.serverRotation) * object.serverVelocity * object.blendTime;
                object.x = boundedLerp(clientX, serverX, object.blendFactor, 0, game.assets.map.width / 16.0);
                object.y = boundedLerp(clientY, serverY, object.blendFactor, 0, game.assets.map.height / 16.0);
            } else {
                object.x += Math.sin(object.rotation) * object.velocity * deltatime;
                object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            }
        }
    
        object.x = modfract(object.x, game.assets.map.width / 16.0);
        object.y = modfract(object.y, game.assets.map.height / 16.0);
        object.rotation = modfract(object.rotation + Math.PI, Math.PI * 2.0) - Math.PI;

        if (object.type === ObjectType.Ship && object.ownership === ObjectOwnership.Local) {
            game.cameraX = object.x;
            game.cameraY = object.y;
        }
    }

    game.objects = game.objects.filter((object) => object.alive);
}

function onRender(game: Game) {
    game.ctx.reset();
    game.ctx.imageSmoothingEnabled = false;
    game.ctx.fillStyle = "#dff6f5";
    game.ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

    game.ctx.resetTransform();
    game.ctx.translate(game.canvas.width * 0.5, game.canvas.height * 0.5);
    const dpr = window.devicePixelRatio || 1;
    game.ctx.scale(dpr, dpr);
    game.ctx.scale(32, 32);
    game.ctx.translate(-game.cameraX, -game.cameraY);

    game.ctx.save();
    game.ctx.imageSmoothingEnabled = true;
    for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
            game.ctx.drawImage(game.assets.map, x * game.assets.map.width / 16.0, y * game.assets.map.height / 16.0, game.assets.map.width / 16.0, game.assets.map.height / 16.0);
        }
    }
    game.ctx.restore();

    if (game.objectsChanged) {
        game.objects.sort((a: Object, b: Object) => b.type - a.type);
        game.objectsChanged = false;
    }
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        game.ctx.save();

        if (object.type === ObjectType.Ship) {
            game.ctx.shadowColor = "rgb(0 0 0 / 25%)";
            game.ctx.shadowBlur = 2;
            game.ctx.shadowOffsetY = 24;
        } else if (object.type === ObjectType.Munition) {
            game.ctx.shadowColor = "#ffbd20";
            game.ctx.shadowBlur = 16;
        }

        let x = object.x;
        let y = object.y;

        if (x - game.cameraX > game.assets.map.width / 32.0) { x -= game.assets.map.width / 16.0; }
        if (x - game.cameraX < -game.assets.map.width / 32.0) { x += game.assets.map.width / 16.0; }
        if (y - game.cameraY > game.assets.map.height / 32.0) { y -= game.assets.map.height / 16.0; }
        if (y - game.cameraY < -game.assets.map.height / 32.0) { y += game.assets.map.height / 16.0; }

        game.ctx.translate(x, y);
        game.ctx.rotate(object.rotation);
        game.ctx.translate(-object.textureRegion.w / 32, -object.textureRegion.h / 32);
        game.ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 16, object.textureRegion.h / 16);
        game.ctx.restore();
    }

    game.ctx.resetTransform();
    game.ctx.fillStyle = "white";
    game.ctx.strokeStyle = "#434a5f";
    game.ctx.font = '48px "Press Start 2P", system-ui';
    game.ctx.lineWidth = 8;
    game.ctx.strokeText(`Score ${game.score}`, 64, 128);
    game.ctx.fillText(`Score ${game.score}`, 64, 128);
    game.ctx.font = '24px "Press Start 2P", system-ui';
    game.ctx.lineWidth = 8;
    game.ctx.strokeText(`Hi-Score ${game.maxScore}`, 64, 160);
    game.ctx.fillText(`Hi-Score ${game.maxScore}`, 64, 160);
    if (game.serverScore !== null) {
        game.ctx.strokeText(`Global Hi-Score ${game.serverScore}`, 64, 192);
        game.ctx.fillText(`Global Hi-Score ${game.serverScore}`, 64, 192);
    }
}

function resizeCanvas(game: Game) {
    const dpr = window.devicePixelRatio || 1;
    game.canvas.width = window.innerWidth * dpr;
    game.canvas.height = window.innerHeight * dpr;
}

function lerp(a: number, b: number, t: number) {
    return a * (1.0 - t) + b * t;
}

function clamp(a: number, min: number, max: number) {
    return Math.max(min, Math.min(a, max));
}

function boundedDiff(a: number, b: number, min: number, max: number) {
    let delta = b - a;
    if ((max - min) - Math.abs(delta) < Math.abs(delta)) { delta = ((max - min) - Math.abs(delta)) * Math.sign(-delta); }
    return delta;
}

function boundedLerp(a: number, b: number, t: number, min: number, max: number) {
    return a + boundedDiff(a, b, min, max) * t;
}

function modfract(a: number, b: number) {
    return b === 0.0 ? a : a - Math.floor(a / b) * b;
}

function getTimestamp(game: Game) {
    if (game.offsetVal !== null) {
        return new Date().getTime() + game.offsetVal;
    } else {
        return 0.0;
    }
}

function getTimediff(game: Game, timestamp: number) {
    if (timestamp !== 0.0 && game.offsetVal !== null) {
        return (getTimestamp(game) - timestamp) / 1000.0;
    } else {
        return 0.0;
    }
}

function spawnPlayer(game: Game, x: number, y: number) {
    game.player = { 
        alive: true,
        type: ObjectType.Ship,
        ownership: ObjectOwnership.Local,
        ref: push(ref(game.db, "objects")),
        x: x, 
        y: y,
        rotation: Math.random() * Math.PI * 2.0 - Math.PI,
        velocity: 16.0,
        clientX: 0, 
        clientY: 0,
        clientRotation: 0.0,
        clientVelocity: 0.0,
        serverX: 0, 
        serverY: 0,
        serverRotation: 0.0,
        serverVelocity: 0.0,
        texture: game.assets.ships,
        textureRegion: { x: Math.floor(Math.random() * 4) * 32, y: Math.floor(Math.random() * 3) * 32, w: 32, h: 32 },
        shootTime: 0.0,
        updateTime: 0.0,
        blendTime: 0.0,
        blendFactor: 0.0,
        onValueUnsubscribe: null
    };
    if (game.score > game.maxScore) {
        game.maxScore = game.score;
        if (game.scoreRef !== null && (game.serverScore === null || game.score > game.serverScore)) {
            set(game.scoreRef, game.maxScore);
        }
    }
    game.score = 0;
    game.scoreTime = 0.0;
    addObject(game, game.player);
}

function spawnEnemy(game: Game, x: number, y: number, u: number, v: number) {
    addObject(game, {
        alive: true,
        type: ObjectType.Enemy,
        ownership: ObjectOwnership.Local,
        ref: push(ref(game.db, "objects")),
        x: x,
        y: y,
        rotation: Math.random() * Math.PI * 2.0 - Math.PI,
        velocity: 0.0,
        clientX: 0, 
        clientY: 0,
        clientRotation: 0.0,
        clientVelocity: 0.0,
        serverX: 0, 
        serverY: 0,
        serverRotation: 0.0,
        serverVelocity: 0.0,
        texture: game.assets.tiles,
        textureRegion: { x: u, y: v, w: 16, h: 16 },
        shootTime: 0.0,
        updateTime: 0.0,
        blendTime: 0.0,
        blendFactor: 0.0,
        onValueUnsubscribe: null
    });
}

function spawnMunition(game: Game, object: Object, velocity: number, u: number, v: number) {
    addObject(game, {
        alive: true,
        type: ObjectType.Munition,
        ownership: ObjectOwnership.Local,
        ref: null,
        x: object.x + Math.sin(object.rotation) * 1.0,
        y: object.y - Math.cos(object.rotation) * 1.0,
        rotation: object.rotation,
        velocity: velocity,
        clientX: 0, 
        clientY: 0,
        clientRotation: 0.0,
        clientVelocity: 0.0,
        serverX: 0, 
        serverY: 0,
        serverRotation: 0.0,
        serverVelocity: 0.0,
        texture: game.assets.tiles,
        textureRegion: { x: u, y: v, w: 16, h: 16 },
        shootTime: 0.0,
        updateTime: 0.0,
        blendTime: 0.0,
        blendFactor: 0.0,
        onValueUnsubscribe: null
    });
}

function spawnExplosion(game: Game, x: number, y: number) {
    addObject(game, {
        alive: true,
        type: ObjectType.Explosion,
        ownership: ObjectOwnership.Local,
        ref: null,
        x: x,
        y: y,
        rotation: 0.0,
        velocity: 0.0,
        clientX: 0, 
        clientY: 0,
        clientRotation: 0.0,
        clientVelocity: 0.0,
        serverX: 0, 
        serverY: 0,
        serverRotation: 0.0,
        serverVelocity: 0.0,
        texture: game.assets.tiles,
        textureRegion: { x: 64 + Math.floor(Math.random() * 3) * 16, y: 0, w: 16, h: 16 },
        shootTime: 0.0,
        updateTime: 0.0,
        blendTime: 0.0,
        blendFactor: 0.0,
        onValueUnsubscribe: null
    });
}

function addObject(game: Game, object: Object) {
    game.objects.push(object);
    game.objectsChanged = true;
    if (object.type === ObjectType.Enemy) {
        game.enemyCount++;
    }
    if (object.ownership === ObjectOwnership.Remote || object.ref === null) {
        return;
    }
    onDisconnect(object.ref).remove();
    set(object.ref, {
        type: object.type,
        serverX: object.x, 
        serverY: object.y,
        serverRotation: object.rotation,
        serverVelocity: object.velocity,
        texture: object.texture.src,
        textureRegion: object.textureRegion,
        timestamp: getTimestamp(game)
    });
}

function removeObject(game: Game, object: Object) {
    if (!object.alive) {
        return;
    }
    object.alive = false;
    game.objectsChanged = true;
    if (game.player === object) {
        game.player = null;
        game.spawnTime = 3.0;
    }
    if (object.type === ObjectType.Enemy) {
        game.enemyCount--;
    }
    if ((object.ownership === ObjectOwnership.Local || object.type === ObjectType.Enemy) && object.ref !== null) {
        remove(object.ref);
    }
}
