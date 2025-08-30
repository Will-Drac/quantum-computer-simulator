let tracks = {}


let gates = {}
gates["GP(θ)"] = {
    Gate: new GPhase([0, function (phase) { return phase }]),
    inputs: ["λ"],
    qbits: [],
    appliedQbits: [],
    controlQbits: [],
}

gates["U(θ,φ,λ)"] = {
    Gate: new Unitary([0, function (theta) { return theta }], [1, function (phi) { return phi }], [2, function (lambda) { return lambda }]),
    inputs: ["θ", "φ", "λ"],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["P(λ)"] = {
    Gate: new Gate([
        new GateComponent(new GPhase([0, function (lambda) { return lambda }]), [new Modifier("control")])
    ]),
    inputs: ["λ"],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["X"] = {
    Gate: new Gate([
        new GateComponent(new Unitary(pi, 0, pi), []),
        new GateComponent(new GPhase(-pi / 2), [])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["Y"] = {
    Gate: new Gate([
        new GateComponent(new Unitary(pi, pi / 2, pi / 2), []),
        new GateComponent(new GPhase(-pi / 2), [])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["Z"] = {
    Gate: gates["P(λ)"].Gate,
    inputs: [pi],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["H"] = {
    Gate: new Gate([
        new GateComponent(new Unitary(pi / 2, 0, pi), []),
        new GateComponent(new GPhase(-pi / 4), [])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["S"] = {
    Gate: new Gate([
        new GateComponent(gates["Z"].Gate, [new Modifier("power", 0.5)])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["S†"] = {
    Gate: new Gate([
        new GateComponent(gates["Z"].Gate, [new Modifier("power", -0.5)])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["T"] = {
    Gate: new Gate([
        new GateComponent(gates["Z"].Gate, [new Modifier("power", 0.25)])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["T†"] = {
    Gate: new Gate([
        new GateComponent(gates["Z"].Gate, [new Modifier("power", -0.25)])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["√X"] = {
    Gate: new Gate([
        new GateComponent(gates["X"].Gate, [new Modifier("power", 0.5)])
    ]),
    inputs: [],
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["RX(θ)"] = {
    Gate: new Gate([
        new GateComponent(new Unitary([0, function (theta) { return theta }], -pi / 2, pi / 2), []),
        new GateComponent(new GPhase([0, function (theta) { return -theta / 2 }]), [])
    ]),
    inputs: ["θ", "θ"], //the same twice because the same input goes to both components
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["RY(θ)"] = {
    Gate: new Gate([
        new GateComponent(new Unitary([0, function (theta) { return theta }], 0, 0), []),
        new GateComponent(new GPhase([0, function (theta) { return -theta / 2 }]), [])
    ]),
    inputs: ["θ", "θ"], //the same twice because the same input goes to both components
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["RZ(λ)"] = {
    Gate: new Gate([
        new GateComponent(new GPhase([0, function (lambda) { return -lambda / 2 }]), []),
        new GateComponent(new Unitary(0, 0, [0, function (lambda) { return lambda }]), [])
    ]),
    inputs: ["λ", "λ"], //the same twice because the same input goes to both components
    qbits: ["a"],
    appliedQbits: ["a"],
    controlQbits: [],
}

gates["SWAP"] = {
    Gate: new Gate([
        new GateComponent(gates["X"], new Modifier("control")),
        new GateComponent(gates["X"], new Modifier("control")),
        new GateComponent(gates["X"], new Modifier("control"))
    ]),
    inputs: [],
    qbits: ["a", "b"],
    appliedQbits: ["b", "a", "b"],
    controlQbits: ["a", "b", "a"],
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