import { makeVideo } from '@chef-hat/video-maker'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { S3Event } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { Readable } from 'node:stream'
import unzip from 'unzip-stream'
import path from 'node:path'
import fs from 'node:fs'
import { Upload } from '@aws-sdk/lib-storage'

const s3 = new S3Client({ region: 'ap-southeast-2' })

export const handler = async (event: S3Event): Promise<void> => {
	const record = event.Records[0]
	if (!record) {
		console.error('First S3 record is undefined.')
		return
	}

	const bucketName = record.s3.bucket.name
	const key = record.s3.object.key

	const response = await s3.send(
		new GetObjectCommand({ Bucket: bucketName, Key: key }),
	)
	const stream = response.Body
	if (!(stream instanceof Readable)) {
		console.error('Response body is not a readable stream')
		return
	}

	let audioPath: string | null = null
	let imagePath: string | null = null

	stream.pipe(unzip.Parse()).on('entry', (entry) => {
		const filePath = entry.path

		if (typeof filePath === 'string') {
			const filename = path.parse(filePath).name

			if (filename === 'img') {
				imagePath = '/tmp/img.jpg'
				entry.pipe(fs.createWriteStream(imagePath))
				return
			}

			if (filename === 'audio') {
				audioPath = '/tmp/audio.mp3'
				entry.pipe(fs.createWriteStream(audioPath))
				return
			}
		}

		entry.autodrain()
	})

	await new Promise((resolve) => stream.on('close', resolve))

	if (!audioPath || !imagePath) {
		console.error('Audio path and image path are not both defined')
		return
	}

	const videoPath = `/tmp/${uuidv4()}.mp4`
	await makeVideo({ audioPath, imagePath, outputPath: videoPath })

	const videoStream = fs.createReadStream(videoPath)
	try {
		const uploadToS3 = new Upload({
			client: s3,
			params: {
				Bucket: process.env.OUTPUT_BUCKET_NAME,
				Key: videoPath,
				Body: videoStream,
			},
		})

		uploadToS3.on('httpUploadProgress', (progress) =>
			console.log(`Uploading video, current progress: ${progress.total}`),
		)

		await uploadToS3.done()
	} catch (e) {
		if (e instanceof Error) {
			console.error(
				`Failed to upload video, the following error occurred ${e.message}`,
			)
		} else {
			console.error('Failed to upload video, an unknown error occurred.')
		}
	}
}
