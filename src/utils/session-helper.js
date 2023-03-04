import {
  saveFileInContainer,
  createContainerAt,
  getSolidDataset,
  getThingAll,
  createThing,
  buildThing,
  setThing,
  saveSolidDatasetAt,
  createSolidDataset,
  saveSolidDatasetInContainer,
  deleteContainer,
  deleteFile,
  createAcl,
  setAgentResourceAccess,
  saveAclFor,
  setAgentDefaultAccess,
  getSolidDatasetWithAcl,
  getResourceAcl
} from '@inrupt/solid-client';
import { SCHEMA_INRUPT } from '@inrupt/vocab-common-rdf';

/**
 * URL to Solid Provider
 * @name SOLID_IDENTITY_PROVIDER
 * @type {string}
 */

export const SOLID_IDENTITY_PROVIDER = 'https://opencommons.net';

/**
 * Function helps put file into Pod container
 * @memberof utils
 * @function placeFileInContainer
 * @param {Session} session - Solid Session
 * @param {Object} fileObject - Object of file being uploaded to Solid
 * @param {string} containerUrl - URL location of Pod container
 * @returns {Promise} Promise - A message regarding the status of upload to user's Pod
 */

const placeFileInContainer = async (session, fileObject, containerUrl) => {
  try {
    await saveFileInContainer(containerUrl, fileObject.file, {
      slug: fileObject.file.name,
      contentType: fileObject.type,
      fetch: session.fetch
    });
  } catch (error) {
    console.log(error);
  }
};

/**
 * Function that checks if location has TTL files
 * @memberof utils
 * @function hasTTLFiles
 * @param {string} containerUrl - URL of location in question
 * @returns {Object|null} ttlFiles or null - An object of first ttl file in location or null, if file does not exist
 */

const hasTTLFiles = (containerUrl) => {
  const items = getThingAll(containerUrl);
  if (!items) {
    return null;
  }

  const ttlFiles = items.find((item) => item.url.slice(-3) === 'ttl');
  if (ttlFiles) {
    return ttlFiles;
  }

  return null;
};

/**
 * Function checks if location has any files
 * @memberof utils
 * @function hasFiles
 * @param {string} containerUrl - URL of location in question
 * @returns {Array|null} [directory, files] or null - an Array of Objects consisting of the directory container and the rest of the files or null
 */

// Sub-routine to check for any existing files in directory to help in container deletion from Pod
const hasFiles = (containerUrl) => {
  const items = getThingAll(containerUrl);
  if (!items) {
    return null;
  }

  let directory = '';
  const files = [];

  items.forEach((file) => {
    if (!file.url.slice(-3).includes('/')) {
      files.push(file);
    } else {
      directory = file;
    }
  });

  return [directory, files];
};

/**
 * Function that returns location of file container, if exist
 * @memberof utils
 * @function fetchUrl
 * @param {Session} session - Solid Session
 * @param {string} fileType - Type of document
 * @param {string} fetchType - Type of fetch (to own Pod, or "self-fetch" or to other Pods, or "cross-fetch")
 * @param {string} otherPodUrl - Url to other user's Pod or empty string
 * @returns {string|null} url or null - A url location of where the file is located in or null, if doesn't exist
 */

const fetchUrl = (session, fileType, fetchType, otherPodUrl) => {
  let POD_URL;
  if (fetchType === 'self-fetch') {
    POD_URL = String(session.info.webId.split('profile')[0]);
  } else {
    POD_URL = `https://${otherPodUrl}/`;
  }

  switch (fileType) {
    case 'Bank Statement':
      return `${POD_URL}Bank%20Statement/`;
    case 'Passport':
      return `${POD_URL}Passport/`;
    case 'Drivers License':
      return `${POD_URL}Drivers%20License/`;
    default:
      return null;
  }
};

/**
 * Function that setups ACL permissions for resource with ACL file
 * @memberof utils
 * @function setupAcl
 * @param {AclDataset} resourceWithAcl - A Solid Session Dataset with ACL file
 * @param {string} webId - Solid webId
 * @param {Access} accessObject - Solid Access Object which sets ACL permission for read, append, write, and control
 * @returns {AclDataset} - Solid Session Dataset with updated ACL file
 */

const setupAcl = (resourceWithAcl, webId, accessObject) => {
  // setAgentResourceAccess will set ACL for resource and setAgentDefaultAcess will set ACL for resource container
  let acl = setAgentResourceAccess(resourceWithAcl, webId, accessObject);
  acl = setAgentDefaultAccess(acl, webId, accessObject);

  return acl;
};

/**
 * Function that generates ACL file for container containing document and turtle file and give user access and control to them
 * @memberof utils
 * @function createDocAclForUser
 * @param {Session} session - Solid Session
 * @param {string} documentUrl - Url link to document container
 * @returns {Promise} Promise - Generates ACL file for container and give user access and control to it and its contents
 */

const createDocAclForUser = async (session, documentUrl) => {
  const podResourceWithoutAcl = await getSolidDataset(documentUrl, { fetch: session.fetch });

  const resourceAcl = createAcl(podResourceWithoutAcl);
  const accessObject = {
    read: true,
    append: true,
    write: true,
    control: true
  };

  const newAcl = setupAcl(resourceAcl, session.info.webId, accessObject);
  await saveAclFor(podResourceWithoutAcl, newAcl, { fetch: session.fetch });
  console.log(`ACL generated for ${documentUrl}`);
};

/**
 * Function that set permissions for document container's ACL file
 * @memberof utils
 * @function setDocAclPermission
 * @param {Session} session - Solid Session
 * @param {string} fileType - Type of document
 * @param {string} fetchType - Type of fetch (to own Pod, or "self-fetch" or to other Pods, or "cross-fetch")
 * @param {string} otherPodUrl - Url to other user's Pod or empty string
 * @returns {Promise} Promise - Sets permission for otherPodUrl for given document type, if exists
 */

export const setDocAclPermission = async (session, fileType, accessType, otherPodUrl) => {
  const documentUrl = fetchUrl(session, fileType, 'self-fetch');

  const podResouceWithAcl = await getSolidDatasetWithAcl(documentUrl, { fetch: session.fetch });

  const resourceAcl = getResourceAcl(podResouceWithAcl);
  const webId = `https://${otherPodUrl}/profile/card#me`;
  let accessObject;
  if (accessType === 'Give') {
    accessObject = { read: true };
  } else {
    accessObject = { read: false };
  }

  const updatedAcl = setupAcl(resourceAcl, webId, accessObject);
  await saveAclFor(podResouceWithAcl, updatedAcl, { fetch: session.fetch });
  console.log(`Permissions for ${fileType} has been set to: "${accessType}"`);
};

/**
 * @typedef fileObject
 * @property {string} type - Type of document
 * @property {string} date - Date of upload
 * @property {string} description - Description of document
 * @property {Object} file - An object which contain infomation about the file being uploaded as well the document itself
 */

/**
 * Function that uploads file to Pod on Solid
 * @memberof utils
 * @function uploadDocument
 * @param {Session} session - Solid Session
 * @param {fileObject} fileObject - Object containing information about file from form submission
 * @returns {Promise} Promise - File upload is handled via Solid libraries
 */

// Main function to upload document to user's Pod on Solid
export const uploadDocument = async (session, fileObject) => {
  const documentUrl = fetchUrl(session, fileObject.type, 'self-fetch');
  await createContainerAt(documentUrl, { fetch: session.fetch });

  const storedFile = await placeFileInContainer(session, fileObject, documentUrl);
  const getDatasetFromUrl = await getSolidDataset(documentUrl, { fetch: session.fetch });

  const ttlFile = hasTTLFiles(getDatasetFromUrl);
  const toBeUpdated = buildThing(createThing({ name: storedFile }))
    .addStringNoLocale(SCHEMA_INRUPT.name, fileObject.file.name)
    .addStringNoLocale(SCHEMA_INRUPT.identifier, fileObject.type)
    .addStringNoLocale(SCHEMA_INRUPT.endDate, fileObject.date)
    .addStringNoLocale(SCHEMA_INRUPT.description, fileObject.description)
    .build();

  let myDataset;
  if (ttlFile !== null) {
    myDataset = await getSolidDataset(ttlFile, { fetch: session.fetch });
    console.log('Call original dataset: ', myDataset);
    myDataset = setThing(myDataset, toBeUpdated);

    const result = await saveSolidDatasetAt(ttlFile, documentUrl, myDataset, {
      fetch: session.fetch
    });
    console.log('New dataset: ', result);
  } else {
    let courseSolidDataset = createSolidDataset();
    courseSolidDataset = setThing(courseSolidDataset, toBeUpdated);

    const result = await saveSolidDatasetInContainer(documentUrl, courseSolidDataset, {
      fetch: session.fetch
    });
    console.log('Newly generated and uploaded dataset: ', result);

    await createDocAclForUser(session, documentUrl);
  }

  console.log(
    `Uploaded ${fileObject.file.name} to pod successfully and set identifier to ${fileObject.type},
    end date to ${fileObject.date}, and description to ${fileObject.description}`
  );
};

/**
 * Function that fetch information of file from Pod on Solid, if exist
 * @memberof utils
 * @function fetchDocuments
 * @param {Session} session - Solid Session
 * @param {string} fileType - Type of document
 * @param {string} fetchType - Type of fetch (to own Pod, or "self-fetch" or to other Pods, or "cross-fetch")
 * @param {string} [otherPodUrl] - Url to other user's Pod (set to empty string by default)
 * @returns {Promise} Promise - Either a string containing the url location of the document, if exist, or throws an Error
 */

export const fetchDocuments = async (session, fileType, fetchType, otherPodUrl = '') => {
  const documentUrl = fetchUrl(session, fileType, fetchType, otherPodUrl);

  try {
    await getSolidDataset(documentUrl, { fetch: session.fetch });
    return documentUrl;
  } catch (error) {
    console.log('No data found or unauthorized');
    throw new Error('No data found or unauthorized');
  }
};

/**
 * Function that delete file from Pod on Solid, if exist
 * @memberof utils
 * @function deleteDocuments
 * @param {Session} session - Solid Session
 * @param {string} fileType - Type of document
 * @returns {Promise} container.url - The URL of document container and the response on whether document file is deleted, if exist, and delete all existing files within it
 */

export const deleteDocumentFile = async (session, fileType) => {
  const documentUrl = fetchUrl(session, fileType, 'self-fetch');
  const fetched = await getSolidDataset(documentUrl, { fetch: session.fetch });

  // Solid requires all files within Pod Container must be deleted before
  // the container itself can be delete itself
  const [container, files] = hasFiles(fetched);
  files.filter(async (file) => {
    if (!file.url.slice(-3).includes('/')) {
      await deleteFile(file.url, { fetch: session.fetch });
    }
  });

  return container.url;
};

/**
 * Function that delete file from Pod on Solid, if exist
 * @memberof utils
 * @function deleteDocumentContainer
 * @param {Session} session - Solid Session
 * @param {string} documentUrl - Url of document container
 * @returns {Promise} Promise - Perform action that deletes container completely from Pod
 */

export const deleteDocumentContainer = async (session, documentUrl) => {
  await deleteContainer(documentUrl, { fetch: session.fetch });
};
