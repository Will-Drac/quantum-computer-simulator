@group(0) @binding(0) var<storage, read_write> stateReal: array<f32>;
@group(0) @binding(1) var<storage, read_write> stateImag: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;
const qbit = _QBIT;
const measurementMade = _MEASUREMENT;
const chanceOfMeasurementMade = _MEASUREMENTPROB;

// does this state include the qbit in the state which is impossible?
fn qbitIsRejected(value: u32) -> bool {
    return ((value >> qbit) & 1u) != measurementMade;
}

@compute @workgroup_size(1) fn collapseState(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        if (qbitIsRejected(row)) {
            stateReal[row] = 0;
            stateImag[row] = 0;
        }
        else {
            // we keep this entry but rescale it to account for the possibilities that were removed
            let multiplier = 1 / sqrt(chanceOfMeasurementMade);
            stateReal[row] = stateReal[row] * multiplier;
            stateImag[row] = stateImag[row] * multiplier;
        }
    }
}