const X = new Unitary(pi, 0, pi)
const H = new Unitary(pi / 2, 0, pi)
const RY = new Unitary([0, function (v) { return v }], 0, 0)
const RZ = new Unitary(0, [0, function (v) { return v }], 0)

const CX = new Gate([new GateComponent(X, [new Modifier("control")])])
const CRY = new Gate([new GateComponent(RY, [new Modifier("control")])])
const CRY4 = new Gate([new GateComponent(CRY, [new Modifier("power", 4)])])

const PHASE = new GPhase([0, function (phase) { return phase }])

const CPHASE = new Gate([new GateComponent(PHASE, [new Modifier("negativeControl")])])

let gates = {
    gphase: { Gate: new GPhase([0, function (phase) { return phase }]), inputs: ["λ"], qbits: 0 },
    u: { Gate: new Unitary([0, function (theta) { return theta }], [1, function (phi) { return phi }], [2, function (lambda) { return lambda }]), inputs: ["θ", "φ", "λ"], qbits: 1 }
}

/*
// const g = new Unitary(2*pi*Math.random(), 2*pi*Math.random(), 2*pi*Math.random())
const g = H

let t = 0
setInterval(async function () {
    const s = new State(1)
    await s.apply(g, [], [0], [], [new Modifier("power", t/1000)])
    const blochPos = (await s.getQbitInfo(0)).position

    // drawBloch(document.getElementById("testCanvas"), blochPos, t / 3000, 0.75 * sin(t / 3000))
    drawBloch(document.getElementById("testCanvas"), blochPos, -pi/6, pi/4)
    t += 16
}, 16)
*/