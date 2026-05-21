import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { TattlerIdentityV0 } from './tattler-protocol';

interface TattlerPiEventKeyDefinition {
  request: string;
  response: string;
}

const TattlerPiEventBusKey = {
  listPeers: {
    request: 'tattler:request:listPeers',
    response: 'tattler:request:listPeers',
  } as const as TattlerPiEventKeyDefinition,
  ownIdentity: {
    request: 'tattler:request:ownIdentity',
    response: 'tattler:response:ownIdentity',
  } as const as TattlerPiEventKeyDefinition,
} as const;

async function request<T>(eventKey: TattlerPiEventKeyDefinition, pi: ExtensionAPI): Promise<T> {
  return new Promise((resolve) => {
    pi.events.on(eventKey.response, (data) => {
      resolve(data as T);
    });

    pi.events.emit(eventKey.request, {});
  });
}

export async function requestListPeers(pi: ExtensionAPI): Promise<TattlerIdentityV0[]> {
  return request<TattlerIdentityV0[]>(TattlerPiEventBusKey.listPeers, pi);
}

export async function requestOwnIdentity(pi: ExtensionAPI): Promise<TattlerIdentityV0> {
  return request<TattlerIdentityV0>(TattlerPiEventBusKey.ownIdentity, pi);
}
