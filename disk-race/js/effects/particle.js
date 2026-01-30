import { Vector } from '../utils/vector.js';

export class Particle {
    constructor(x, y, color) {
        this.position = new Vector(x, y);
        this.velocity = new Vector(
            (Math.random() - 0.5) * 8,  // Random horizontal velocity
            (Math.random() - 0.5) * 8   // Random vertical velocity
        );
        this.color = color;
        this.alpha = 1.0;
        this.radius = 2 + Math.random() * 2; // Random size 2-4
        this.lifetime = 0;
        this.maxLifetime = 0.5 + Math.random() * 0.5; // 0.5-1 seconds
    }

    update(deltaTime) {
        this.lifetime += deltaTime / 60; // Convert to seconds
        this.position.add(this.velocity.clone().multiply(deltaTime));

        // Fade out
        this.alpha = 1 - (this.lifetime / this.maxLifetime);

        // Slow down
        this.velocity.multiply(0.95);

        return this.lifetime < this.maxLifetime;
    }

    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createBurst(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    update(deltaTime) {
        this.particles = this.particles.filter(p => p.update(deltaTime));
    }

    render(ctx) {
        this.particles.forEach(p => p.render(ctx));
    }

    clear() {
        this.particles = [];
    }
}
