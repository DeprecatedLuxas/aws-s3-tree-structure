#!/usr/bin/env node
import * as fs from "fs";
import * as AWS from "aws-sdk";
import * as inquirer from "inquirer";

let treeStructureObject: any = {};

function buildTreeStructure(array: any) {
    let map: any = treeStructureObject;
    for (const item of array) {
        map[item] = map[item] || {};
        map = map[item];
    }
}

function listAllObjects(
    s3Client: AWS.S3,
    objects: any,
    bucket: string,
    callback: any,
    token?: string
) {
    let opts: AWS.S3.ListObjectsV2Request = {
        Bucket: bucket,
    };
    if (token) opts.ContinuationToken = token;

    s3Client.listObjectsV2(opts, function (err: any, data: any) {
        if (err) {
            callback(err, null);
        }
        objects = objects.concat(data.Contents);
        if (data.IsTruncated) {
            listAllObjects(
                s3Client,
                objects,
                bucket,
                callback,
                data.NextContinuationToken
            );
        } else {
            callback(null, objects);
        }
    });
}

(async () => {
    const { accessKeyId, secretAccessKey } = await inquirer.prompt([
        {
            type: "input",
            message: "Type your Amazon Access Key Id:",
            name: "accessKeyId",
        },
        {
            type: "input",
            message: "Type your Amazon Secret Access Key:",
            name: "secretAccessKey",
        },
    ]);
    const s3: AWS.S3 = new AWS.S3({
        apiVersion: "latest",
        credentials: new AWS.Credentials({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        }),
    });

    try {
        const bucketList: AWS.S3.Buckets = await new Promise(
            (success, failure) => {
                s3.listBuckets(function (err: any, data: any) {
                    if (err) {
                        failure(err);
                    } else {
                        success(data.Buckets);
                    }
                });
            }
        );
        const { bucket } = await inquirer.prompt([
            {
                type: "list",
                name: "bucket",
                message: "Pick the correct bucket:",
                choices: bucketList.map((bucket: AWS.S3.Bucket) => bucket.Name),
            },
        ]);


        let objects: AWS.S3.ObjectList = [];
        let allObjects: AWS.S3.ObjectList = await new Promise(
            (success, failure) => {
                listAllObjects(s3, objects, bucket, (err: any, data: any) => {
                    if (err) {
                        failure(err);
                    } else {
                        success(data);
                    }
                });
            }
        );
        allObjects
            .map((object: AWS.S3.Object) => object.Key)
            .map((item: any) => item.split("/"))
            .forEach((itemParts) => {
                buildTreeStructure(itemParts);
            });
        fs.writeFileSync(
            "./awstreestructure.json",
            JSON.stringify(treeStructureObject, null, 4)
        );
        console.log("Generated a Tree Structure file based on your s3 files.");
    } catch (err) {
        console.log(`Code returned with error code ${err.code}`);
    }

})();
