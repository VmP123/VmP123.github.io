import { TrackPiece } from './trackPiece.js';
import { WallUtils } from '../utils/wallUtils.js';
import { CONFIG } from '../config.js';

export class TrackLoader {
    static async loadTrack(filepath) {
        try {
            // Check if there's a track in localStorage from the editor
            const editorTrack = localStorage.getItem('editorTrack');
            if (editorTrack) {
                console.log('Loading track from editor (localStorage)');
                const data = JSON.parse(editorTrack);
                return TrackLoader.parseTrack(data);
            }

            // Otherwise load from file
            const response = await fetch(filepath);
            if (!response.ok) {
                throw new Error(`Failed to load track: ${response.statusText}`);
            }

            const data = await response.json();
            return TrackLoader.parseTrack(data);
        } catch (error) {
            console.error('Error loading track:', error);
            throw error;
        }
    }

    static parseTrack(data) {
        const toRad = (deg) => deg * (Math.PI / 180);

        const track = {
            pieces: [],
            startLine: {
                x: data.startLine.x,
                y: data.startLine.y,
                angle: toRad(data.startLine.angle || 0)
            },
            name: data.name || 'Unnamed Track'
        };

        // Parse each track piece
        for (const pieceData of data.pieces) {
            const piece = new TrackPiece(
                pieceData.type,
                pieceData.x,
                pieceData.y,
                toRad(pieceData.angle || 0),
                pieceData.leftWall,
                pieceData.rightWall
            );
            track.pieces.push(piece);
        }

        // If there's no 'start' piece, create one from startLine data
        const hasStartPiece = track.pieces.some(p => p.type === 'start');
        if (!hasStartPiece && data.startLine) {
            const startPiece = new TrackPiece(
                'start',
                data.startLine.x,
                data.startLine.y,
                toRad(data.startLine.angle || 0),
                true,
                true
            );
            track.pieces.unshift(startPiece); // Add at the beginning
        }

        // Pre-compute wall caps for physics
        track.wallCaps = WallUtils.computeWallCaps(track.pieces, CONFIG);

        return track;
    }
}
