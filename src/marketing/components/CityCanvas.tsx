import React, { useEffect, useRef } from 'react';

const CityCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        // Handle High DPI screens
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        interface Point {
            x: number;
            y: number;
            z: number;
            type: 'city' | 'light' | 'ground' | 'star';
            phase: number; // For twinkling/animation
        }

        let points: Point[] = [];
        let rotation = 0;
        const rotationSpeed = 0.0005; // Slower, more majestic rotation
        let mouseY = 0;
        let animationFrameId: number;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            // Context properties are reset when canvas size changes, so we must rescale
            ctx.scale(dpr, dpr);
        };

        const initPoints = () => {
            points = [];

            // 1. Skyscrapers (Dubai Skyline)
            // Reduced number of buildings and density for cleaner look
            const numBuildings = 50;

            for (let i = 0; i < numBuildings; i++) {
                const angle = Math.random() * Math.PI * 2;
                // Distribute from center outwards (0 to 600) to fill the gap left by Burj
                const dist = Math.random() * 600;
                const bx = Math.cos(angle) * dist;
                const bz = Math.sin(angle) * dist;

                // Varying heights for skyline effect
                const bHeight = 80 + Math.random() * 250;
                const bWidth = 8 + Math.random() * 20;

                // Reduced density (higher step) for fewer particles
                const density = 18;

                for (let h = 0; h < bHeight; h += density) {
                    const phase = Math.random() * Math.PI * 2;

                    // Only draw corners to reduce count further while keeping shape
                    points.push({ x: bx - bWidth, y: -h, z: bz - bWidth, type: 'city', phase });
                    points.push({ x: bx + bWidth, y: -h, z: bz - bWidth, type: 'city', phase });
                    points.push({ x: bx + bWidth, y: -h, z: bz + bWidth, type: 'city', phase });
                    points.push({ x: bx - bWidth, y: -h, z: bz + bWidth, type: 'city', phase });

                    // Occasional random lights on building faces
                    if (Math.random() > 0.85) {
                        points.push({
                            x: bx + (Math.random() - 0.5) * bWidth * 2,
                            y: -h,
                            z: bz + (Math.random() - 0.5) * bWidth * 2,
                            type: 'light',
                            phase: Math.random() * Math.PI * 2
                        });
                    }
                }
                // Roof light
                points.push({ x: bx, y: -bHeight, z: bz, type: 'light', phase: Math.random() * Math.PI * 2 });
            }

            // 2. Ground/Water Plane (Grid)
            // Increased gridStep to reduce particles
            const gridSize = 700;
            const gridStep = 60;
            for (let x = -gridSize; x <= gridSize; x += gridStep) {
                for (let z = -gridSize; z <= gridSize; z += gridStep) {
                    // Add some random variation to grid points
                    const nx = x + (Math.random() - 0.5) * 15;
                    const nz = z + (Math.random() - 0.5) * 15;

                    points.push({ x: nx, y: 0, z: nz, type: 'ground', phase: 0 });
                }
            }

            // 3. Ambient floating particles (Stars/Dust)
            for (let i = 0; i < 100; i++) {
                points.push({
                    x: (Math.random() - 0.5) * 1500,
                    y: -Math.random() * 600,
                    z: (Math.random() - 0.5) * 1500,
                    type: 'star',
                    phase: Math.random() * Math.PI * 2
                });
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            rotation += rotationSpeed;
            const time = Date.now() * 0.001;

            const cx = width / 2;
            const cy = height / 2 + 150; // Lower camera slightly
            const targetTilt = 0.15 - (mouseY / height) * 0.3;
            const tilt = targetTilt;

            points.forEach(p => {
                let x1 = p.x * Math.cos(rotation) - p.z * Math.sin(rotation);
                let z1 = p.z * Math.cos(rotation) + p.x * Math.sin(rotation);
                let y1 = p.y;

                let y2 = y1 * Math.cos(tilt) - z1 * Math.sin(tilt);
                let z2 = z1 * Math.cos(tilt) + y1 * Math.sin(tilt);
                let x2 = x1;

                const fov = 800;
                const scale = fov / (fov + z2);

                const x2d = x2 * scale + cx;
                const y2d = y2 * scale + cy;

                if (scale > 0 && z2 > -fov) {
                    let alpha = Math.max(0.05, (scale - 0.1));
                    let size = scale * 1.5;

                    if (p.type === 'city') {
                        ctx.fillStyle = `rgba(148, 163, 184, ${alpha * 0.3})`; // Reduced opacity for city
                    } else if (p.type === 'light') {
                        const twinkle = 0.5 + Math.sin(time * 3 + p.phase) * 0.5;
                        ctx.fillStyle = `rgba(250, 204, 21, ${alpha * twinkle * 0.7})`; // Reduced opacity for lights
                        size = scale * 2.2;
                    } else if (p.type === 'star') {
                        const twinkle = 0.3 + Math.sin(time + p.phase) * 0.7;
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * twinkle * 0.5})`; // Reduced opacity for stars
                        size = scale * 1.0;
                    } else {
                        // Ground
                        ctx.fillStyle = `rgba(71, 85, 105, ${alpha * 0.15})`; // Reduced opacity for ground
                    }

                    ctx.beginPath();
                    ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseY = e.clientY;
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        initPoints();
        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full z-0 pointer-events-none"
        />
    );
};

export default CityCanvas;
