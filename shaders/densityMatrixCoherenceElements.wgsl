@group(0) @binding(0) var<storage, read> stateReal: array<f32>;
@group(0) @binding(1) var<storage, read> stateImag: array<f32>;
@group(0) @binding(2) var<storage, read_write> elementsReal: array<f32>;
@group(0) @binding(3) var<storage, read_write> elementsImag: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;
const qbit: u32 = _QBIT;

fn powU(base: u32, exponent: u32) -> u32 {
    var prod: u32 = 1;

    for (var i: u32 = 0; i < exponent; i++) {
        prod *= base;
    }

    return prod;
}

@compute @workgroup_size(1) fn getCoherenceElements(
    @builtin(global_invocation_id) id: vec3u
) {
    let n = id.x * workgroupsPerDimension + id.y;

    if (n < size) {
        let twoQbit: u32 = powU(2, qbit);
        let i = n%twoQbit + 2*twoQbit*u32(f32(n)/f32(twoQbit));
        let j = i + twoQbit;

        // this element is the entry of the state vector at i multiplied by the complex conjugate of the entry of the state vector at j
        let stateIReal = stateReal[i];
        let stateIImag = stateImag[i];

        let stateJReal = stateReal[j];
        let stateJImag = stateImag[j];

        // doing he complex multiplication (stateJImag being *=-1 because it's the conjugate)
        elementsReal[n] = stateIReal*stateJReal + stateIImag*stateJImag;
        elementsImag[n] = stateIImag*stateJReal - stateIReal*stateJImag;
    }
}