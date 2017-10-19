
class Data {
    /**
     * 
     * @param {SchemaField[]} schema 
     * @param {any[][]} values 
     */
    constructor(schema, values) {
        this.schema = schema;
        this.values = values;

        /** @type {{[x: string]: []}} */
        this._possibleCategoricalValues = {};

        for (let i = 0; i < this.schema.length; i++) {
            if (this.schema[i].type == DataTypes.CATEGORICAL) {
                this._possibleCategoricalValues[this.schema[i].label] = [];

                for (let j = 0; j < this.values.length; j++) {
                    let value = this.values[j][i];

                    if (this._possibleCategoricalValues[this.schema[i].label].indexOf(value) === -1) {
                        this._possibleCategoricalValues[this.schema[i].label].push(value);
                    }
                }
            }
        }
    }

    at(index) {
        return this.values[index];
    }

    numericVariableAt(rowIndex, colIndex) {
        let row = this.values[rowIndex];

        switch (this.schema[colIndex].type) {
            case DataTypes.NUMERICAL:
                return parseFloat(row[colIndex]);
            case DataTypes.CATEGORICAL:
                return this._possibleCategoricalValues[this.schema[colIndex].label].indexOf(row[colIndex]);
            default:
                row[colIndex];
        }
    }

    /**
     * Reverse lookup a predicted value by column and float value
     * @param {colIndex} value 
     * @param {number} value
     */
    reverseLookup(colIndex, value) {
        const schemaField = this.schema[colIndex];

        switch (schemaField.type) {
            case DataTypes.CATEGORICAL: {
                let possibleValues = this._possibleCategoricalValues[schemaField.label];
                return possibleValues[Math.floor(value * possibleValues.length)];
            }
            default:
                return value;
        }
    }

    /**
     * Modifies this in-place to include other
     * @param {Data} other 
     */
    extend(other, allowDifferentSchemas=false) {
        // compare schemas
        // if (!allowDifferentSchemas) {
        //     if (this.schema.length != other.schema.length) {
        //         throw Error('Schemas do not match size');
        //     }

        //     for (let field of this.schema) {
        //         if (Object.prototype.hasOwnProperty.apply(this.schema, key)) {
        //             if (!Object.prototype.hasOwnProperty.apply(other.schema, key)) {
        //                 throw Error('Schemas must match: other network does not have "' + key + '"');
        //             }
        //         }
        //     }
        // // }

        // for (let key in this.schema) {
        //     if (Object.prototype.hasOwnProperty.apply(this.schema, key) && Object.prototype.hasOwnProperty.apply(other.schema, key)) {
        //         if (this.schema[key]. != other.schema[key]) {
        //             throw Error('Datatypes differ for field "' + key + '" (' + this.schema[key] + ' vs ' + other.schema[key] + ')');
        //         }
        //     }
        // }

        // if (allowDifferentSchemas) {
        //     // copy schema values over from other into this
        //     for (let key in other.schema) {
        //         if (!Object.prototype.hasOwnProperty.apply(this.schema, key) && Object.prototype.hasOwnProperty.apply(other.schema, key)) {
        //             this.schema[key] = other.schema[key];
        //         }
        //     }
        // }

        // this.values = this.values.concat(other.values);

        // return this;
    }
}

class SchemaField {
    constructor(label, type) {
        this.label = label;
        this.type = type;
    }
}

/**
 * @param {any[][]} rows
 * @param {string[]} hasHeader
 */
Data.from = function (rows, header=null) {
    if (rows.length == 0) {
        throw Error('No rows provided.');
    }

    const row0Schema = getRowSchema(rows[0]);

    if (header != null) {
        if (header.length != rows[0].length) {
            throw Error('Header column length must be same as data column length');
        }

        return new Data(header.map((label, i) => new SchemaField(label, row0Schema[i])));
    }


    return new Data(rows[0].map((el, i) => {
        let rem = (i % 26);
        let div = Math.floor(i / 26) + 1;

        let label = String.fromCharCode(65 + rem) + div;

        return new SchemaField(label, row0Schema[i]);
    }), rows);
};

class TrainedData {
    /**
     * 
     * @param {number[]} vWeights 
     * @param {number[][]} wWeights
     * @param {number[]} bias
     */
    constructor(vWeights, wWeights, bias) {
        this.vWeights = vWeights;
        this.wWeights = wWeights;
        this.bias = bias;
    }

    /**
     * Merges in-place
     * @param {TrainedData} other 
     */
    extend(other) {
        this.vWeights = this.vWeights.concat(other.vWeights);
        this.wWeights = this.wWeights.concat(other.wWeights);
        this.bias = this.bias.concat(other.bias);

        return this;
    }
}

const NUM_ITERATIONS = 1000;

class Result {
    /**
     * 
     * @param {function(number[])} predictor 
     */
    constructor(predictor) {
        this._predictor = predictor;
    }

    /**
     * @param {number[]} input 
     */
    predict(input) {
        return this._predictor(input);
    }

    /**
     * @param {Result} other 
     * @param {number?} weight 
     */
    combineWith(other, weight=0.5) {
        if (weight <= 0.0 || weight >= 1.0) {
            throw Error('weight must be <= 0 or >= 1');
        }

        return new Result((input) => {
            const a = this.predict(input);
            const b = other.predict(input);
    
            return a * (1.0 - weight) + b * weight;
        });
    }
}

class NeuralNetwork {
    /**
     * @param {Data} inputData
     * @param {Data} outputData
    */
    constructor(inputData, outputData) {
        if (inputData.values.length != outputData.values.length) {
            throw Error('input data must have same length as output data');
        }

        this.inputData = inputData;
        this.outputData = outputData;

        this._dimension = inputData.values[0].length;

        /** @type {TrainedData} */
        this.trainedData = null;
    }

    _initBias() {
        let bias = new Array(this._dimension);
        for (let i = 0; i < this._dimension; i++) {
            bias[i] = Math.random() - 0.5; // put in (-0.5, 0.5) range
        }
        return bias;
    }

    _initWeights() {
        let vWeights = [];
        let wWeights = [];

        for (let i = 0; i < this._dimension; i++) {
            vWeights.push(Math.random() - 0.5);
            let wIdx = wWeights.push([]) - 1;

            for (let j = 0; j < this._dimension; j++) {
                wWeights[wIdx].push(Math.random() - 0.5);
            }
        }

        return [vWeights, wWeights];
    }

    _initTrainedData() {
        let bias = this._initBias();
        let [vWeights, wWeights] = this._initWeights();

        this.trainedData = new TrainedData(vWeights, wWeights, bias);
    }

    /**
     * @param {number} rowIndex 
     */
    _extractRow(rowIndex) {
        let elements = new Array(this._dimension);

        for (let i = 0; i < elements.length; i++) {
            elements[i] = this.inputData.numericVariableAt(rowIndex, i);
        }

        return elements;
    }

    /**
     * Modifies the network in-place to include another network
     * @param {NeuralNetwork} other
     */
    extend(other) {
        if (this._dimension != other._dimension) {
            throw Error('dimensions must match');
        }

        this.inputData.extend(other.inputData);
        this.outputData.extend(other.outputData);

        if (this.trainedData != null && other.trainedData != null) {
            this.trainedData.extend(other.trainedData);
        }

        return this;
    }

    /**
     * @returns {Promise<Result>}
     */
    train() {
        this._initTrainedData();

        let bout = 0.0;

        // sigmoid function
        const transfer = (value) => {
            return 1.0 / (1.0 + Math.exp(-value));
        };

        /**
         * @param {number[]} rowElements
         */
        const calculateFOut = (rowElements) => {
            /** @type {number[]} */
            let arr = Array.from(Array(this._dimension)).map((el, i) => {
                let sum = 0.0;
                
                for (let j = 0; j < this._dimension; j++) {
                    sum += rowElements[j] * this.trainedData.wWeights[j][i];
                }

                return transfer(sum + this.trainedData.bias[i]);
            });

            // for (let i = 0; i < this._dimension; i++) {
            //     let sum = 0.0;

            //     for (let j = 0; j < this._dimension; j++) {
            //         sum += rowElements[j] * this.trainedData.wWeights[j][i];
            //     }

            //     arr[i] = transfer(sum + this.trainedData.bias[i]);
            // }

            let fout = arr.reduce((accum, el, i) => {
                return accum + (el * this.trainedData.vWeights[i]);
            }, 0);

            fout = transfer(fout + bout);

            return { fout, foutArray: arr };
        };

        /**
         * @param {number} output
         * @param {number} numNeurons 
         * @param {number} dimension 
         * @param {number} fout 
         * @param {number[]} foutArray
         * @param {number[]} rowElements
         */
        const learn = (output, fout, foutArray, rowElements) => {
            let error = output - fout;
            let n = 0.05;

            let dv;
            let dwi = new Array(this._dimension);
            let dw = new Array(this._dimension);

            for (let i = 0; i < dw.length; i++) {
                dw[i] = new Array(this._dimension);
            }

            let dbi = new Array(this._dimension);
            let db = new Array(this._dimension);

            dv = fout * (1.0 - fout) * error;
            for (let i = 0; i < this._dimension; i++) {
                this.trainedData.vWeights[i] += n * dv * foutArray[i];
            }

            let dbout = n * dv;
            bout += dbout;

            for (let i = 0; i < this._dimension; i++) {
                dwi[i] = foutArray[i] * (1.0 - foutArray[i]) * this.trainedData.vWeights[i] * dv;

                for (let j = 0; j < this._dimension; j++) {
                    dw[j][i] = n * dwi[i] * rowElements[j];
                    this.trainedData.wWeights[j][i] += dw[j][i];
                }
            }

            // modify bias
            for (let i = 0; i < this._dimension; i++) {
                dbi[i] = foutArray[i] * (1.0 - foutArray[i]) * this.trainedData.vWeights[i] * dv;
                db[i] = n * dbi[i];
                this.trainedData.bias[i] += db[i];
            }
        };

        return new Promise((resolve, reject) => {
            setTimeout(() => { // run parallel
                let quadraticError = 0.0;
                
                for (let i = 0; i < NUM_ITERATIONS; i++) {
                    for (let j = 0; j < this.outputData.values.length; j++) {
                        let rowElements = this._extractRow(j);
                        let { fout, foutArray } = calculateFOut(rowElements);
                        let x = this.outputData.numericVariableAt(j, 0)/* first item as arrays not supported yet */;

                        learn(x, fout, foutArray, rowElements);
                        quadraticError += Math.pow(x - fout, 2);
                    }

                    quadraticError *= 0.5;
                }

                resolve(new Result((input) => calculateFOut(input).fout));

            }, 0);
        });
    }
}

class ColumnPicker {
    /** @param {number} numColumns */
    constructor(numColumns) {
        this.numColumns = numColumns;
        this._dataset = new Set();
        this._exclude = [];
    }

    values() {
        return [...this._dataset].filter(x => this._exclude.indexOf(x) === -1);
    }

    /**
     * Add specific columns to the dataset
     * @param {...number} colsToKeep
     */
    pick(...colsToKeep) {
        for (let i = 0; i < colsToKeep.length; i++) {
            if (colsToKeep[i] < 0 || colsToKeep[i] >= this.numColumns) {
                throw Error(`${colsToKeep[i]} is out of range of number of columns (${this.numColumns})`);
            }

            this._dataset.add(colsToKeep[i]);
        }

        return this;
    }

    /**
     * Remove specific columns from the dataset
     * @param {...number} colsToRemove
     */
    exclude(...colsToRemove) {
        Array.prototype.push.apply(this._exclude, colsToRemove);
        return this;
    }

    /**
     * Add a range of columns to the dataset
     * @param {number} start 
     * @param {number} end 
     */
    range(start, end) {
        const sign = Math.sign(end - start);

        if (sign == 1) {
            for (let i = start; i < end; i += 1) {
                this._dataset.add(i);
            }
        } else if (sign == -1) {
            for (let i = start; i > end; i -= 1) {
                this._dataset.add(i);
            }
        } else if (sign == 0) {
            this._dataset.add(start);
        }

        return this;
    }
}

const DataTypes = {
    NUMERICAL: 'numerical',
    CATEGORICAL: 'categorical',
    BOOLEAN: 'boolean'
};

/**
 * @param {string} str 
 */
function getDataType(str) {
    if (!isNaN(str)) {
        return DataTypes.NUMERICAL;
    } else if (['true', 'false'].indexOf(str.toLowerCase()) !== -1) {
        return DataTypes.BOOLEAN;
    } else {
        return DataTypes.CATEGORICAL;
    }
}

/**
 * @param {string[]} row
 */
function getRowSchema(row) {
    return row.map(x => getDataType(String(x)));
}

NeuralNetwork.Builder = {
    /** @param {string} csv */
    fromCsv: (csv) => {
        let split = csv.split('\n')
            .map(x => x.trim())
            .filter(x => x.length != 0);

        if (split.length == 0) {
            throw Error('No input rows');
        }

        split = split.map(row => row.split(','));

        const numRows = split.length;
        const numColumns = split[0].length;

        const inputColumnPicker = new ColumnPicker(numColumns);
        const outputColumnPicker = new ColumnPicker(numColumns);

        return {
            hasHeader: true,
            inputs: inputColumnPicker,
            outputs: outputColumnPicker,

            header: function (enabled=true) {
                this.hasHeader = enabled;
            },

            build: function () {
                const inputColumnIndices = inputColumnPicker.values();
                const outputColumnIndices = outputColumnPicker.values();

                const inputData = [];
                const outputData = [];

                let header = null;

                split.forEach((row, rowIdx) => {
                    if (this.hasHeader && rowIdx == 0) {
                        header = row;
                        return;
                    }

                    let inputArr = [];
                    let outputArr = [];

                    for (let i = 0; i < row.length; i++) {
                        if (inputColumnIndices.indexOf(i) !== -1) {
                            inputArr.push(row[i]);
                        }
                        
                        if (outputColumnIndices.indexOf(i) !== -1) {
                            outputArr.push(row[i]);
                        }
                    }

                    inputData.push(inputArr);
                    outputData.push(outputArr);
                });
                
                return new NeuralNetwork(Data.from(inputData, header), Data.from(outputData, header));
            }
        };
    }
};

let builder = NeuralNetwork.Builder.fromCsv(TEST_CSV_DATA);
builder.header(false);
builder.inputs.range(0, 3);
builder.outputs.pick(3);
let nn = builder.build();

let builder2 = NeuralNetwork.Builder.fromCsv(TEST_CSV_DATA_2);
builder2.header(false);
builder2.inputs.range(0, 3);
builder2.outputs.pick(3);
let nn2 = builder2.build();

Promise.all([nn.train(), nn2.train()]).then(([r1, r2]) => {
    // predict if average is > than 2
    // console.log('NN #1: ', r1.predict([2,2,2]).fout > 0.5 ? "> 2" : "<= 2");
    // // predict if average is >= than 2.5
    // console.log('NN #2: ', r2.predict([2,2,2]).fout > 0.5 ? ">= 2.5" : "< 2.5");

    const testInput = [2.5,2.5,2.5];


    console.log('#1: ', r1.predict(testInput));
    console.log('#2: ', r2.predict(testInput));
    console.log('merged: ', nn.outputData.reverseLookup(0, r1.combineWith(r2).predict(testInput)))
});

// function generateTestData(size) {
//     let ins = [];
//     let outs = [];

//     for (let i = 0; i < size; i++) {
//         let theseIns = [];

//         for (let i = 0; i < 3; i++) {
//             theseIns.push((Math.random() * 3).toFixed(2));
//         }

//         ins.push(theseIns);

//         outs.push(theseIns.reduce((accum, el) => accum + (el * (1.0 / theseIns.length)), 0.0) > 2 ? '1' : '0');
//     }

//     return ins.map((x, i) => {
//         return x.concat([outs[i]]).join(',');
//     }).join('\n');
// }

// let csv = generateTestData(1000);
// console.log(csv);