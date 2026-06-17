export type ComposioExecuteActionRequest = {
  actionName: string;
  connectedAccountId: string;
  input: Record<string, unknown>;
};

export type ComposioExecuteActionResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export type InstagramMediaContainerResponse = {
  id: string;
};

export type InstagramPublishResponse = {
  id: string;
  mediaId?: string;
  status?: string;
};
