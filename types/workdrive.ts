export interface WorkDriveFile {
  id: string
  name: string
  type: string
  size: number
  extension: string
  createdTime: string
  isImage: boolean
}

export interface WorkDriveFolderLink {
  folderId: string
  folderName: string
}

export interface WorkDriveUploadResult {
  fileId: string
  name: string
}
