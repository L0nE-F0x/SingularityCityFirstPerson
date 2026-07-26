/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CITY ELEVATOR (v16.5.0 - Extracted from interior_city_props.js)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

class CityElevator {
    constructor(layer, numFloors, floorHeight, shaftX) {
        this.layer = layer;
        this.numFloors = numFloors;
        this.floorHeight = floorHeight;
        this.x = shaftX;
        this.destroyed = false;

        this.state = 'idle';
        this.currentFloor = 0;
        this.targetFloor = 0;
        this.timer = 0;
        this.doorWidth = 24;
        this.speed = 2.5;

        this.callQueue = [];
        this.doors = [];

        this.shaft = new PIXI.Graphics();
        this.shaft.beginFill(0x1a1a24);
        this.shaft.drawRect(
            this.x - this.doorWidth,
            -((this.numFloors - 1) * this.floorHeight),
            this.doorWidth * 2,
            (this.numFloors + 1) * this.floorHeight
        );
        this.shaft.endFill();
        this.layer.addChild(this.shaft);

        this.car = new PIXI.Graphics();
        this.car.beginFill(0x3a3a4c);
        this.car.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth * 2, this.floorHeight - 5);
        this.car.endFill();
        this.car.x = this.x;
        this.car.y = 0;
        this.layer.addChild(this.car);

        const totalFloors = numFloors + 1;

        for (let i = -1; i < numFloors; i++) {
            let fy = -i * this.floorHeight;

            let leftDoor = new PIXI.Graphics();
            let rightDoor = new PIXI.Graphics();
            this.drawDoor(leftDoor, true);
            this.drawDoor(rightDoor, false);
            leftDoor.x = this.x; leftDoor.y = fy;
            rightDoor.x = this.x; rightDoor.y = fy;

            this.layer.addChild(leftDoor, rightDoor);

            let lightContainer = new PIXI.Container();
            lightContainer.x = this.x;
            lightContainer.y = fy - this.floorHeight + 12;

            let floorLights = [];
            for (let j = -1; j < numFloors; j++) {
                let l = new PIXI.Graphics();
                l.beginFill(0x222222);
                const maxW = 36;
                const spacing = Math.min(6, maxW / totalFloors);
                const lightIdx = j + 1;
                l.drawCircle((lightIdx - totalFloors / 2) * spacing + (spacing / 2), 0, Math.min(1.5, spacing / 3));
                l.endFill();
                floorLights.push(l);
                lightContainer.addChild(l);
            }
            this.layer.addChild(lightContainer);

            this.doors.push({
                left: leftDoor,
                right: rightDoor,
                openAmt: 0,
                lights: floorLights,
                floorNum: i
            });
        }
    }

    drawDoor(gfx, isLeft) {
        gfx.clear();
        gfx.beginFill(0x4a4a5a);
        gfx.lineStyle(1, 0x2a2a3a);
        if (isLeft) {
            gfx.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        } else {
            gfx.drawRect(0, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        }
        gfx.endFill();
    }

    call(floor) {
        if (!this.callQueue.includes(floor) && (this.currentFloor !== floor || this.state !== 'open')) {
            this.callQueue.push(floor);
        }
    }

    update() {
        if (this.destroyed || !this.car || this.car.destroyed) { this.destroyed = true; return; }
        let currentPassingFloor = -Math.round(this.car.y / this.floorHeight);
        const totalFloors = this.numFloors + 1;
        const maxW = 36;
        const spacing = Math.min(6, maxW / totalFloors);

        this.doors.forEach((doorObj) => {
            doorObj.lights.forEach((light, lightIdx) => {
                const representedFloor = lightIdx - 1;
                light.clear();
                if (representedFloor === currentPassingFloor) {
                    light.beginFill(0x4ade80);
                } else {
                    light.beginFill(0x222222);
                }
                light.drawCircle((lightIdx - totalFloors / 2) * spacing + (spacing / 2), 0, Math.min(1.5, spacing / 3));
                light.endFill();
            });
        });

        if (this.state === 'idle') {
            if (this.callQueue.length > 0) {
                this.targetFloor = this.callQueue.shift();
                if (this.targetFloor === this.currentFloor) {
                    this.state = 'opening';
                } else {
                    this.state = 'moving';
                }
            }
        }
        else if (this.state === 'moving') {
            let targetY = -this.targetFloor * this.floorHeight;
            let dir = Math.sign(targetY - this.car.y);
            this.car.y += dir * this.speed;

            if (Math.abs(this.car.y - targetY) <= this.speed) {
                this.car.y = targetY;
                this.currentFloor = this.targetFloor;
                this.state = 'opening';
            }
        }
        else if (this.state === 'opening') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt += 0.05;
            if (door.openAmt >= 1) {
                door.openAmt = 1;
                this.state = 'open';
                this.timer = 90;
            }
            this.updateDoorVisuals(door);
        }
        else if (this.state === 'open') {
            this.timer--;
            if (this.timer <= 0) {
                this.state = 'closing';
            }
        }
        else if (this.state === 'closing') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt -= 0.05;
            if (door.openAmt <= 0) {
                door.openAmt = 0;
                this.state = 'idle';
            }
            this.updateDoorVisuals(door);
        }
    }

    updateDoorVisuals(door) {
        door.left.x = this.x - (door.openAmt * this.doorWidth * 0.9);
        door.right.x = this.x + (door.openAmt * this.doorWidth * 0.9);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.shaft && !this.shaft.destroyed) this.shaft.destroy();
        this.shaft = null;
        if (this.car && !this.car.destroyed) this.car.destroy();
        this.car = null;
        if (this.doors) {
            this.doors.forEach(d => {
                if (d.left && !d.left.destroyed) d.left.destroy();
                if (d.right && !d.right.destroyed) d.right.destroy();
                if (d.lights) d.lights.forEach(l => { if (l && !l.destroyed) l.destroy(); });
            });
            this.doors = [];
        }
    }
}
