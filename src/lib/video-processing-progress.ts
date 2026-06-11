export const videoProcessingStages = [
  {
    status: "queued",
    label: "Queued",
    description: "Your task is waiting for the Reap worker.",
    progress: 10,
  },
  {
    status: "uploading_to_reap",
    label: "Sending source",
    description: "The source video is being prepared and sent to Reap.",
    progress: 28,
  },
  {
    status: "processing_in_reap",
    label: "Finding clips",
    description: "Reap is analyzing the video and finding the strongest moments.",
    progress: 58,
  },
  {
    status: "downloading_from_reap",
    label: "Fetching results",
    description: "Generated clips are being collected from Reap.",
    progress: 78,
  },
  {
    status: "storing_clips",
    label: "Saving clips",
    description: "Clip files are being secured in your storage.",
    progress: 90,
  },
  {
    status: "generating_caption",
    label: "Preparing metadata",
    description: "Titles and captions are being prepared for review.",
    progress: 96,
  },
] as const;

export type VideoProcessingStatus = (typeof videoProcessingStages)[number]["status"];

export function isVideoProcessingStatus(status: string): status is VideoProcessingStatus {
  return videoProcessingStages.some((stage) => stage.status === status);
}

export function getVideoProcessingProgress(status: string) {
  const stageIndex = videoProcessingStages.findIndex((stage) => stage.status === status);

  if (stageIndex === -1) {
    return null;
  }

  return {
    ...videoProcessingStages[stageIndex],
    stageIndex,
    stageNumber: stageIndex + 1,
    totalStages: videoProcessingStages.length,
  };
}
