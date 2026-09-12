const ContactDirectory = require("../../models/contactDirectory.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");

const toContactResponse = (contact) => {
  const plain = contact.toJSON();
  return {
    id: plain.id,
    deliveryName: plain.deliveryName,
    phone: plain.phone,
    createdAt: plain.created_at ?? plain.createdAt ?? null,
    updatedAt: plain.updated_at ?? plain.updatedAt ?? null,
  };
};

const toPublicContact = (contact) => {
  const { id, deliveryName, phone } = toContactResponse(contact);
  return { id, deliveryName, phone };
};

const findContactOrFail = async (id) => {
  const contact = await ContactDirectory.findByPk(id);
  if (!contact) throw AppError.fail("Contact not found.", 404);
  return contact;
};

const createContact = async (req) => {
  const { deliveryName, phone } = req.body;
  const contact = await ContactDirectory.create({
    deliveryName,
    phone: phone,
  });
  return { contact: toContactResponse(contact) };
};

const listContacts = async (req) => {
  const currentPage = Math.max(
    Number(req.query.page) || PAGINATION.DEFAULT_PAGE,
    1,
  );
  const pageSize = PAGINATION.DEFAULT_LIMIT;
  const { count, rows } = await ContactDirectory.findAndCountAll({
    attributes: ["id", "deliveryName", "phone", "created_at", "updated_at"],
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });
  const totalPages = Math.ceil(count / pageSize) || 0;

  return {
    contacts: rows.map(toContactResponse),
    pagination: {
      totalItems: count,
      totalPages,
      currentPage,
      pageSize,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };
};

const getContactById = async (req) => {
  const contact = await findContactOrFail(req.params.id);
  return { contact: toContactResponse(contact) };
};

const updateContact = async (req) => {
  const contact = await findContactOrFail(req.params.id);
  const updates = { ...req.body };
  if (updates.phone !== undefined) {
    updates.phone = normalizeContactPhone(updates.phone);
  }
  await contact.update(updates);
  return { contact: toContactResponse(contact) };
};

const listPublicContacts = async () => {
  const contacts = await ContactDirectory.findAll({
    attributes: ["id", "deliveryName", "phone"],
    order: [
      ["delivery_name", "ASC"],
      ["id", "ASC"],
    ],
  });
  return { contacts: contacts.map(toPublicContact) };
};

module.exports = {
  createContact,
  listContacts,
  getContactById,
  updateContact,
  listPublicContacts,
};
