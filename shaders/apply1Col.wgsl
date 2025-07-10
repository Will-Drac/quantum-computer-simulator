@group(0) @binding(0) var<storage, read> matrixCol: array<u32>;

@group(0) @binding(1) var<storage, read> oldStateReal: array<f32>;
@group(0) @binding(2) var<storage, read> oldStateImag: array<f32>;

@group(0) @binding(3) var<storage, read_write> newStateReal: array<f32>;
@group(0) @binding(4) var<storage, read_write> newStateImag: array<f32>;

_ENTRIES
/*
const matrixEntriesReal = vec4f(this.modified.real[0][0], this.modified.real[0][1], this.modified.real[1][0], this.modified.real[1][1]);
const matrixEntriesImag = vec4f(this.modified.imag[0][0], this.modified.imag[0][1], this.modified.imag[1][0], this.modified.imag[1][1]);
*/

_ROWCOL
/*
const rowToCol = vec2u(this.gateMatrix.row0Col, this.gateMatrix.row1Col);
*/

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;

@compute @workgroup_size(1) fn apply2Col(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        let data = matrixCol[row];
        // extracting information out of the 32 bits
        let is1 = (data >> 31) == 1;
        let matrixEntriesRow = (data >> 30) & 0x1;
        var matrixEntriesCol = rowToCol[matrixEntriesRow];
        let column = data & 0x3FFFFFFF;

        var valReal: f32 = 0.;
        var valImag: f32 = 0.;
        if (is1) {
            valReal = 1.;
            valImag = 0.;
        }
        else {
            valReal = matrixEntriesReal[2*matrixEntriesRow + matrixEntriesCol]; // we're flattening the matrix to 1d
            valImag = matrixEntriesImag[2*matrixEntriesRow + matrixEntriesCol];
        }

        // now we can do the matrix multiplication on the old state vector
        // a * b, both complex => (a_r + i a_i) * (b_r + i b_i) = a_r b_r + i a_r b_i + i a_i b_r - a_i b_i = (a_r b_r - a_i b_i) + i (a_r b_i + a_i b_r)

        let stateTermReal = oldStateReal[column];
        let stateTermImag = oldStateImag[column];

        let productReal = valReal * stateTermReal - valImag * stateTermImag;
        let productImag = valReal * stateTermImag + valImag * stateTermReal;

        newStateReal[row] = productReal;
        newStateImag[row] = productImag;
    }
}