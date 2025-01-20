# google-drive-aws-s3-sync

## Disclaimer

## This tool was made for a personal sync of Google Drive folder to an S3, probably has bugs and is missing feature likes

- Renamed files are not handled, they will be handled as new files
- Trashed files on Google Drive will not be deleted on S3 Bucket

Take care before running in Production or in your personal environment.

## Introduction

Scope of this project was to create an automatic sync between a `Google Drive folder` and an `S3 Bucket`, using both APIs offered by two services.
The sync on each run check for new/updated files to be synced of last day. It is expected to be executed in a scheduled way, but could be use as one shot too (updating the filter).

## Pre-requisites

### AWS account

Create an AWS IAM account grating `Put` operation on S3 Bucket

### Google Cloud API

You have to enable [Google Drive API](https://developers.google.com/drive/api/quickstart/nodejs#enable_the_api), create credential and download the configuration.

## Configuration

## Run
