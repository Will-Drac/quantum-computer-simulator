@group(0) @binding(0) var<storage, read> matrixCol0: array<u32>;
@group(0) @binding(1) var<storage, read> matrixCol1: array<u32>;

@group(0) @binding(2) var<storage, read> oldStateReal: array<f32>;
@group(0) @binding(3) var<storage, read> oldStateImag: array<f32>;

@group(0) @binding(4) var<storage, read_write> newStateReal: array<f32>;
@group(0) @binding(5) var<storage, read_write> newStateImag: array<f32>;

_ENTRIES
/*
const matrixEntriesReal = vec4f(this.modified.real[0][0], this.modified.real[0][1], this.modified.real[1][0], this.modified.real[1][1]);
const matrixEntriesImag = vec4f(this.modified.imag[0][0], this.modified.imag[0][1], this.modified.imag[1][0], this.modified.imag[1][1]);
*/

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;

@compute @workgroup_size(1) fn apply2Col(
    @builtin(global_invocation_id) id: vec3u
) {
    let row = id.x * workgroupsPerDimension + id.y;

    if (row < size) {
        let data0 = matrixCol0[row];
        // extracting information out of the 32 bits
        let is10 = (data0 >> 31) == 1;
        let matrixEntriesRow0 = (data0 >> 30) & 0x1;
        let column0 = data0 & 0x3FFFFFFF;

        var val0Real: f32 = 0;
        var val0Imag: f32 = 0;
        if (is10) {
            val0Real = 1;
            val0Imag = 0;
        }
        else {
            val0Real = matrixEntriesReal[2*matrixEntriesRow0]; //2* because this will be the first column (first matrixCol) and we're flattening the matrix to 1d
            val0Imag = matrixEntriesImag[2*matrixEntriesRow0];
        }


        let data1 = matrixCol1[row];
        // extracting information out of the 32 bits
        let is11 = (data1 >> 31) == 1;
        let matrixEntriesRow1 = (data1 >> 30) & 0x2;
        let column1 = data1 & 0x3FFFFFFF;

        var val1Real: f32 = 0;
        var val1Imag: f32 = 0;
        if (is11) {
            val1Real = 1;
            val1Imag = 0;
        }
        else {
            val1Real = matrixEntriesReal[2*matrixEntriesRow1 + 1]; //2* + 1 because this will be the second column (second matrixCol) and we're flattening the matrix to 1d
            val1Imag = matrixEntriesImag[2*matrixEntriesRow1 + 1];
        }

        // now we can do the matrix multiplication on the old state vector
        // a * b, both complex => (a_r + i a_i) * (b_r + i b_i) = a_r b_r + i a_r b_i + i a_i b_r - a_i b_i = (a_r b_r - a_i b_i) + i (a_r b_i + a_i b_r)

        let stateTerm0Real = oldStateReal[column0];
        let stateTerm0Imag = oldStateImag[column0];

        let product0Real = val0Real * stateTerm0Real - val0Imag * stateTerm0Imag;
        let product0Imag = val0Real * stateTerm0Imag + val0Imag * stateTerm0Real;

        let stateTerm1Real = oldStateReal[column1];
        let stateTerm1Imag = oldStateImag[column1];

        let product1Real = val1Real * stateTerm1Real - val1Imag * stateTerm1Imag;
        let product1Imag = val1Real * stateTerm1Imag + val1Imag * stateTerm1Real;

        newStateReal[row] = product0Real + product1Real;
        newStateImag[row] = product0Imag + product1Imag;
    }
}