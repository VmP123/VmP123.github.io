// Vector utility class for 2D vector operations
export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Create a copy of this vector
    clone() {
        return new Vector(this.x, this.y);
    }

    // Add another vector to this one
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    // Subtract another vector from this one
    subtract(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    // Multiply by a scalar
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    // Get the length (magnitude) of this vector
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    // Normalize this vector (make it length 1)
    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    // Get the dot product with another vector
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    // Rotate this vector by an angle (in radians)
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    // Static method to create a vector from an angle and length
    static fromAngle(angle, length = 1) {
        return new Vector(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    // Get the angle of this vector
    angle() {
        return Math.atan2(this.y, this.x);
    }

    // Calculate distance between two points
    static distance(v1, v2) {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
