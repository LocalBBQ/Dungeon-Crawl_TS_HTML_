// Factory for render context passed to layer renderers. Each layer uses only context.ctx, context.camera, context.systems, context.settings.
function createRenderContext(ctx, canvas, camera, systems, settings) {
    return { ctx, canvas, camera, systems, settings };
}

if (typeof window !== 'undefined') {
    window.createRenderContext = createRenderContext;
}
