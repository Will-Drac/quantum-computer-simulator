// drawBloch(document.getElementById("testCanvas"), state, 0)

async function drawBloch(canvas, blochPos, viewAngleYaw, viewAnglePitch) {
    const circleSteps = 30

    const ctx = canvas.getContext("2d")
    const w = canvas.width; const h = canvas.height
    const s = Math.min(w, h)
    const d = 0.9 * s / 2 // radius of the bloch sphere being drawn

    ctx.fillStyle = "rgb(15, 15, 15)"
    ctx.rect(0, 0, w, h)
    ctx.fill()

    ctx.strokeStyle = "white"

    // the outline of the circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, d, 0, 2 * pi)
    ctx.stroke()

    function projectPoint(point) {
        // yaw rotation
        let cameraSpacePos = {
            x: point.x * cos(viewAngleYaw) - point.y * sin(viewAngleYaw),
            y: point.x * sin(viewAngleYaw) + point.y * cos(viewAngleYaw),
            z: point.z
        }
        // pitch rotation
        cameraSpacePos = {
            x: cameraSpacePos.x * cos(viewAnglePitch) + cameraSpacePos.z * sin(viewAnglePitch),
            y: cameraSpacePos.y,
            z: -cameraSpacePos.x * sin(viewAnglePitch) + cameraSpacePos.z * cos(viewAnglePitch)
        }

        // x -> not used ; y -> +x ; z -> -y
        const clipSpacePos = {
            x: cameraSpacePos.y,
            y: -cameraSpacePos.z
        }

        const screenSpacePos = {
            x: clipSpacePos.x * d + w / 2,
            y: clipSpacePos.y * d + h / 2,
            behind: cameraSpacePos.x < 0
        }

        return screenSpacePos
    }

    // draws a vector starting from the origin
    function drawVector(end) {
        const p = projectPoint(end)

        const dist = Math.sqrt((p.x - w / 2) ** 2 + (p.y - h / 2) ** 2)

        if (p.behind) { //draw dashed
            ctx.setLineDash([dist / 5, dist / 10])
        }

        ctx.beginPath()
        ctx.moveTo(w / 2, h / 2)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()

        ctx.setLineDash([])
    }


    // draws a latitudinal (parallel to equator) circle around the sphere from a point
    function drawLatitude(point) {
        const rotationStep = 2 * pi / circleSteps
        let lastProjectedPoint = projectPoint(point)
        for (let i = 0; i <= circleSteps; i++) {
            // rotate it by the step
            point = {
                x: point.x * cos(rotationStep) - point.y * sin(rotationStep),
                y: point.x * sin(rotationStep) + point.y * cos(rotationStep),
                z: point.z
            }

            const s = lastProjectedPoint
            const e = projectPoint(point)

            if (!((s.behind || e.behind) && i % 2 == 0)) {
                ctx.beginPath()
                ctx.moveTo(s.x, s.y)
                ctx.lineTo(e.x, e.y)
                ctx.stroke()
            }

            lastProjectedPoint = e
        }
    }

    function drawLongitude(point) {
        // see what yaw rotation the point has and undo it for now
        const pointYaw = Math.atan2(point.y, point.x)
        point = {
            x: Math.sqrt(point.x ** 2 + point.y ** 2),
            y: 0,
            z: point.z
        }

        const rotationStep = 2 * pi / circleSteps

        // projected point need to first be rotated to have the yaw of the original (before it was removed just above)
        let lastProjectedPoint = projectPoint({
            x: point.x * cos(pointYaw) - point.y * sin(pointYaw),
            y: point.x * sin(pointYaw) + point.y * cos(pointYaw),
            z: point.z
        })

        for (let i = 0; i <= circleSteps; i++) {
            // rotate it by the step
            point = {
                x: point.x * cos(rotationStep) + point.z * sin(rotationStep),
                y: point.y,
                z: -point.x * sin(rotationStep) + point.z * cos(rotationStep)
            }

            // before being projected, the point are re-
            const s = lastProjectedPoint
            const e = projectPoint({
                x: point.x * cos(pointYaw) - point.y * sin(pointYaw),
                y: point.x * sin(pointYaw) + point.y * cos(pointYaw),
                z: point.z
            })

            if (!((s.behind || e.behind) && i % 2 == 0)) {
                ctx.beginPath()
                ctx.moveTo(s.x, s.y)
                ctx.lineTo(e.x, e.y)
                ctx.stroke()
            }

            lastProjectedPoint = e
        }
    }

    ctx.lineWidth = 1

    // the x-axis
    ctx.strokeStyle = "rgb(255, 0, 0)"
    drawVector({ x: 1, y: 0, z: 0 })

    // the y-axis
    ctx.strokeStyle = "rgb(0, 255, 0)"
    drawVector({ x: 0, y: 1, z: 0 })

    // the z-axis
    ctx.strokeStyle = "rgb(0, 0, 255)"
    drawVector({ x: 0, y: 0, z: 1 })
    ctx.strokeStyle = "white"

    // the actual vector
    ctx.lineWidth = 3
    ctx.strokeStyle = "white"
    drawVector(blochPos)

    // latitude and longitude lines to make it easier to look at
    ctx.lineWidth = 1

    ctx.strokeStyle = "rgb(255, 255, 0)"
    drawLatitude(blochPos)

    ctx.strokeStyle = "rgb(255, 0, 255)"
    drawLongitude(blochPos)
}