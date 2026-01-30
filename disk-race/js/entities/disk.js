import { Vector } from '../utils/vector.js';
import { CONFIG } from '../config.js';

export class Disk {
    constructor(x, y, playerId = 0) {
        this.position = new Vector(x, y);
        this.velocity = new Vector(0, 0);
        this.radius = CONFIG.DISK_RADIUS;
        this.startPosition = new Vector(x, y);
        this.isMoving = false;
        this.playerId = playerId;
        this.visible = true; // Whether the disk is visible on the field

        // Get player colors
        const playerColors = CONFIG.COLORS.PLAYER_COLORS[playerId % CONFIG.COLORS.PLAYER_COLORS.length];
        this.color = playerColors.disk;
        this.borderColor = playerColors.border;
    }

    // Launch the disk with a given angle and power (0-1)
    launch(angle, power) {
        const speed = power * CONFIG.DISK_MAX_SPEED;
        this.velocity = Vector.fromAngle(angle, speed);
        this.isMoving = true;
    }

    // Update disk physics
    update(deltaTime) {
        if (!this.isMoving) return;

        // Apply velocity
        this.position.add(this.velocity.clone().multiply(deltaTime));

        // Apply proportional friction (air resistance)
        this.velocity.multiply(Math.pow(CONFIG.FRICTION_COEFFICIENT, deltaTime));

        // Apply linear friction (rolling resistance / ground friction) - stops slow movement faster
        const frictionForce = 0.025 * deltaTime; // Nostettu arvo jotta pysähtyy lopussa nopeasti
        const currentSpeed = this.velocity.length();

        if (currentSpeed > 0) {
            const newSpeed = Math.max(0, currentSpeed - frictionForce);
            this.velocity.multiply(newSpeed / currentSpeed);
        }

        // Stop if moving too slowly
        if (this.velocity.length() < CONFIG.MIN_SPEED_THRESHOLD) {
            this.velocity = new Vector(0, 0);
            this.isMoving = false;
        }
    }

    // Reset disk to start position
    reset() {
        this.position = this.startPosition.clone();
        this.velocity = new Vector(0, 0);
        this.isMoving = false;
        this.visible = true;
    }

    // Return disk to a specific position and stop it
    returnToPosition(pos) {
        this.position = pos.clone();
        this.velocity = new Vector(0, 0);
        this.isMoving = false;
        this.visible = true;
    }

    // Get current speed
    getSpeed() {
        return this.velocity.length();
    }

    // Check if disk is stopped
    isStopped() {
        return !this.isMoving;
    }

    // Bounce off a wall with a given normal vector
    bounce(normal) {
        // Push disk out of the wall first (prevents getting stuck inside walls)
        // Move the disk in the direction of the normal to ensure it's outside the wall
        const pushDistance = 2; // Small push to get fully out of the wall
        this.position.add(normal.clone().multiply(pushDistance));

        // Reflect velocity around the normal (only if moving into the wall)
        const dot = this.velocity.dot(normal);
        if (dot < 0) { // Only bounce if moving into the wall
            this.velocity.subtract(normal.clone().multiply(2 * dot));
            this.velocity.multiply(CONFIG.WALL_BOUNCE_DAMPING);
        }
    }

    // Collide with another disk (elastic collision)
    collideWithDisk(otherDisk) {
        const delta = this.position.clone().subtract(otherDisk.position);
        const distance = delta.length();

        // Check if disks are overlapping
        if (distance < this.radius + otherDisk.radius && distance > 0) {
            // Normalize collision vector
            const normal = delta.clone().normalize();

            // Separate disks so they don't overlap
            const overlap = (this.radius + otherDisk.radius - distance) / 2;
            this.position.add(normal.clone().multiply(overlap));
            otherDisk.position.subtract(normal.clone().multiply(overlap));

            // Calculate relative velocity
            const relativeVelocity = this.velocity.clone().subtract(otherDisk.velocity);
            const velocityAlongNormal = relativeVelocity.dot(normal);

            // Don't resolve if velocities are separating
            if (velocityAlongNormal > 0) return;

            // Calculate impulse (assuming equal mass and elastic collision)
            const restitution = 0.8; // Bounciness (0 = inelastic, 1 = perfectly elastic)
            const impulse = -(1 + restitution) * velocityAlongNormal / 2;

            // Apply impulse
            const impulseVector = normal.clone().multiply(impulse);
            this.velocity.add(impulseVector);
            otherDisk.velocity.subtract(impulseVector);

            // Set both disks as moving if they have velocity
            if (this.velocity.length() > CONFIG.MIN_SPEED_THRESHOLD) {
                this.isMoving = true;
            }
            if (otherDisk.velocity.length() > CONFIG.MIN_SPEED_THRESHOLD) {
                otherDisk.isMoving = true;
            }
        }
    }
}
