import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Tooltip,
} from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import reclamationApi from '../utils/reclamationApi';
import { Building, User } from 'lucide-react';
import { api } from '../utils/api';
import RightClickMenu from './ui/RightClickMenu';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { correctiveActionsApi } from '../utils/correctiveActionsApi';
import PersonForm from './PersonForm';


const { TextArea } = Input;

const ACTION_TYPES = ['Action corrective'];

// Recursively find a record by id inside a nested actions tree
const findActionById = (list, id) => {
  for (const item of list) {
    if (String(item.id) === String(id)) {
      return item;
    }

    if (Array.isArray(item.children) && item.children.length) {
      const found = findActionById(item.children, id);

      if (found) {
        return found;
      }
    }
  }

  return null;
};

// Recursively find a record by its rowKey
const findActionByRowKey = (list, key) => {
  for (const item of list) {
    const itemKey = item.id ?? `${item.type}-${item.description}`;

    if (String(itemKey) === String(key)) {
      return item;
    }

    if (Array.isArray(item.children) && item.children.length) {
      const found = findActionByRowKey(item.children, key);

      if (found) {
        return found;
      }
    }
  }

  return null;
};

export default function ReclamationCorrectiveActions({ reclamationId }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [services, setServices] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [persons, setPersons] = useState([]);

  const [form] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);
  const [showChildren, setShowChildren] = useState(true);

  const { permissions, user } = useAuth();

  const [reclamation, setReclamation] = useState(null);

  // null = create normal action
  // object = edit existing action
  const [editingAction, setEditingAction] = useState(null);


  const [personModalOpen, setPersonModalOpen] = useState(false);

  const [personsLoading, setPersonsLoading] = useState(false);


  // ID of the parent corrective action when creating a sub-action
  const [parentId, setParentId] = useState(null);

  const hasAnyChildren = actions.some(
    (action) =>
      Array.isArray(action.children) &&
      action.children.length > 0
  );

  /**
   * Fetch corrective actions
   */
  const fetchActions = useCallback(async () => {
    if (!reclamationId) {
      return;
    }

    setLoading(true);

    try {
      const res =
        await reclamationApi.listCorrectiveActions(reclamationId);

      const rows = Array.isArray(res.data)
        ? res.data
        : res.data?.data ?? [];

      const markChildren = (list, isChild = false) =>
        list.map((item) => ({
          ...item,
          __isChild: isChild,
          children: Array.isArray(item.children)
            ? markChildren(item.children, true)
            : item.children,
        }));

      setActions(markChildren(rows));
    } catch (err) {
      console.error(err);

      message.error(
        'Impossible de charger les actions correctives.'
      );
    } finally {
      setLoading(false);
    }
  }, [reclamationId]);

  /**
   * Fetch reclamation
   */
  const fetchReclamation = useCallback(async () => {
    if (!reclamationId) {
      return;
    }

    try {
      const res = await reclamationApi.show(reclamationId);

      setReclamation(res.data);
    } catch (err) {
      console.error(err);

      message.error(
        'Impossible de charger la réclamation.'
      );
    }
  }, [reclamationId]);

  /**
   * Fetch services
   */
  const fetchServices = useCallback(async () => {
    try {
      const response = await api.get('services');

      setServices(
        (response?.data?.data || []).map((service) => ({
          label: service.name,
          value: Number(service.id),
        }))
      );
    } catch (error) {
      console.error(error);

      message.error(
        error?.response?.data?.message ||
        "Une erreur s'est produite lors du chargement des services."
      );
    }
  }, []);

  /**
   * Fetch responsables
   *
   * Used for normal corrective actions and editing.
   */
  const fetchResponsibles = useCallback(async () => {
    try {
      const response = await api.get('users/responsibles');

      const rows =
        response?.data?.data ||
        response?.data ||
        [];

      setResponsibles(
        rows.map((u) => ({
          label:
            u.name ??
            u.full_name ??
            `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
          value: Number(u.id),
        }))
      );
    } catch (error) {
      console.error(error);

      message.error(
        error?.response?.data?.message ||
        "Une erreur s'est produite lors du chargement des responsables."
      );
    }
  }, []);

  /**
   * Fetch persons
   *
   * Used only for creating a new sub-action.
   */
  const fetchPersons = useCallback(async () => {
    try {
      const response = await api.get('persons');

      const rows = response?.data || [];

      setPersons(
        rows.map((person) => ({
          label: person.full_name,
          value: Number(person.id),
        }))
      );
    } catch (error) {
      console.error(error);

      message.error(
        error?.response?.data?.message ||
        "Une erreur s'est produite lors du chargement des ResponsableS."
      );
    }
  }, []);

  /**
   * Initial loading
   */
  useEffect(() => {
    fetchServices();
    fetchResponsibles();
    fetchPersons();
    fetchActions();
    fetchReclamation();
  }, [
    fetchServices,
    fetchResponsibles,
    fetchPersons,
    fetchActions,
    fetchReclamation,
  ]);

  /**
   * Open create modal
   *
   * parentId === null
   * => Nouvelle action corrective
   *
   * parentId !== null
   * => Nouvelle sous-action
   */
  const openCreateModal = (forParentId = null) => {
    form.resetFields();

    setEditingAction(null);
    setParentId(forParentId);

    // Default type for create
    form.setFieldValue('type', 'Action corrective');

    setModalOpen(true);
  };

  /**
   * Open edit modal
   *
   * Editing ALWAYS uses responsable_id.
   */
  const openEditModal = (record) => {
    setEditingAction(record);
    setParentId(null);

    form.setFieldsValue({
      type: record.type,

      description: record.description,

      effectiveness_criteria:
        record.effectiveness_criteria,

      due_date: record.due_date
        ? dayjs(record.due_date)
        : undefined,

      service_id:
        record.service_id != null
          ? Number(record.service_id)
          : undefined,

      responsable_id:
        record.responsable_id != null
          ? Number(record.responsable_id)
          : undefined,
    });

    setModalOpen(true);
  };

  /**
   * Submit form
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      const payload = {
        description: values.description,

        type: values.type,

        effectiveness_criteria:
          values.effectiveness_criteria,

        due_date: values.due_date
          ? dayjs(values.due_date).format('YYYY-MM-DD')
          : undefined,

        service_id:
          values.service_id != null
            ? Number(values.service_id)
            : undefined,
      };

      /**
       * ============================================
       * NEW SUB-ACTION
       * ============================================
       *
       * POST:
       * corrective-actions/{parentId}/children
       *
       * Body:
       * person_id
       *
       * NO parent_id in the body.
       */
      if (!editingAction && parentId !== null) {
        payload.person_id =
          values.person_id != null
            ? Number(values.person_id)
            : undefined;

        await correctiveActionsApi.createChild(
          parentId,
          payload
        );

        message.success('Sous-action créée.');
      }

      /**
       * ============================================
       * EDIT EXISTING ACTION
       * ============================================
       *
       * Uses responsable_id.
       */
      else if (editingAction) {
        payload.responsable_id =
          values.responsable_id != null
            ? Number(values.responsable_id)
            : undefined;

        await reclamationApi.updateCorrectiveAction(
          reclamationId,
          editingAction.id,
          payload
        );

        message.success(
          'Action corrective mise à jour.'
        );
      }

      /**
       * ============================================
       * NEW NORMAL CORRECTIVE ACTION
       * ============================================
       *
       * POST:
       * corrective-actions
       *
       * Uses responsable_id.
       */
      else {
        payload.responsable_id =
          values.responsable_id != null
            ? Number(values.responsable_id)
            : undefined;

        await reclamationApi.createCorrectiveAction(
          reclamationId,
          payload
        );

        message.success(
          'Action corrective créée.'
        );
      }

      form.resetFields();

      setModalOpen(false);
      setEditingAction(null);
      setParentId(null);

      fetchActions();
    } catch (err) {
      console.error(err);

      // Ant Design validation error
      if (err?.errorFields) {
        return;
      }

      message.error(
        err?.response?.data?.message ||
        (editingAction
          ? "Échec de la mise à jour de l'action corrective."
          : parentId !== null
            ? "Échec de la création de la sous-action."
            : "Échec de la création de l'action corrective.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Delete action
   */
  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Supprimer cette action corrective ?',

      content: 'Cette action est irréversible.',

      okText: 'Supprimer',

      okType: 'danger',

      cancelText: 'Annuler',

      onOk: async () => {
        try {
          await reclamationApi.deleteCorrectiveAction(
            reclamationId,
            id
          );

          message.success(
            'Action corrective supprimée.'
          );

          fetchActions();
        } catch (err) {
          console.error(err);

          message.error(
            "Échec de la suppression de l'action corrective."
          );
        }
      },
    });
  };

  /**
   * Context menu
   */
  const handleMenuClick = (key, id) => {
    switch (key) {
      case 'edit': {
        const record = findActionById(actions, id);

        if (record) {
          openEditModal(record);
        }

        break;
      }

      case 'addSub':
        openCreateModal(id);
        break;

      case 'delete':
        handleDelete(id);
        break;

      default:
        break;
    }
  };

  /**
   * Context menu items
   */
  const rowMenuItems = (record) => [
    {
      label: 'Modifier',
      key: 'edit',
      id: record?.id,
      disabled:
        !permissions('modifier.action_corrective'),
    },

    {
      label: 'Ajouter une sous-action',
      key: 'addSub',
      id: record?.id,
      disabled:
        !permissions('creer.sous-action_corrective') ||
        Number(record?.responsable_id) !==
        Number(user?.id),
    },

    {
      label: 'Supprimer',
      key: 'delete',
      id: record?.id,
      disabled:
        !permissions('supprimer.action_corrective'),
    },
  ];

  /**
   * Table columns
   *
   * No changes to existing display logic.
   */
  const columns = [
    {
      title: 'Responsable',
      dataIndex: 'responsable',
      key: 'responsable',
      width: 180,
      render: (responsable, record) => {
        const name =
          // Sub-action
          record.person?.full_name ||

          // Normal action
          responsable?.full_name ||

          // Fallback for normal action
          responsibles.find(
            (r) =>
              r.value === Number(record.responsable_id)
          )?.label ||

          '-';

        return (
          <Tag
            color="geekblue"
            style={{
              verticalAlign: 'middle',
              marginRight: 0,
            }}
          >
            {name}
          </Tag>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: (description) => (
        <Tooltip
          title={description}
          placement="topLeft"
        >
          <span>{description}</span>
        </Tooltip>
      ),
    },

    {
      title: 'Échéance',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (date) =>
        date
          ? dayjs(date).format('DD/MM/YYYY')
          : '-',
    },

    {
      title: 'Réalisation',
      dataIndex: 'completion_date',
      key: 'completion_date',
      width: 110,
      render: (date) =>
        date
          ? dayjs(date).format('DD/MM/YYYY')
          : '-',
    },

    {
      title: 'Clôture',
      dataIndex: 'closing_date',
      key: 'closing_date',
      width: 110,
      render: (date) =>
        date
          ? dayjs(date).format('DD/MM/YYYY')
          : '-',
    },

    {
      title: 'Efficacité',
      dataIndex: 'effectiveness',
      key: 'effectiveness',
      width: 110,
    },
  ];

  /**
   * Context menu row
   */
  const ContextMenuRow = (props) => {
    const {
      children,
      ...restProps
    } = props;

    const rowKey =
      restProps['data-row-key'];

    const record =
      rowKey !== undefined
        ? findActionByRowKey(
          actions,
          rowKey
        )
        : null;

    if (!record) {
      return (
        <tr {...restProps}>
          {children}
        </tr>
      );
    }

    return (
      <RightClickMenu
        menuItems={rowMenuItems(record)}
        onItemClick={handleMenuClick}
      >
        <tr {...restProps}>
          {children}
        </tr>
      </RightClickMenu>
    );
  };

  /**
   * Only TRUE for:
   *
   * "Nouvelle sous-action"
   *
   * NOT for edit
   * NOT for normal create
   */
  const isNewSubAction =
    !editingAction && parentId !== null;

  return (
    <div
      style={{
        display: permissions(
          'voir.actions_correctives'
        )
          ? 'block'
          : 'none',
      }}
    >
      <style>{`
        .reclamation-actions-table .child-action-row > td {
          background-color: #fafafa;
        }

        .reclamation-actions-table .child-action-row > td:first-child {
          border-left: 2px solid #91caff;
        }

        .reclamation-actions-table .child-action-row:hover > td {
          background-color: #f0f0f0 !important;
        }
      `}</style>

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-medium m-0">
          Actions correctives
        </h4>

        <div className="flex items-center gap-3">
          {hasAnyChildren && (
            <Tooltip
              title={
                showChildren
                  ? 'Masquer les sous-actions'
                  : 'Afficher les sous-actions'
              }
            >
              <Button
                size="small"
                icon={
                  showChildren ? (
                    <MinusOutlined />
                  ) : (
                    <PlusOutlined />
                  )
                }
                onClick={() =>
                  setShowChildren(
                    (value) => !value
                  )
                }
              />
            </Tooltip>
          )}

          <Button
            size="small"
            type="primary"
            disabled={
              !permissions(
                'creer.action_corrective'
              ) ||
              reclamation?.closing_date ||
              !reclamation
            }
            icon={<PlusOutlined />}
            onClick={() =>
              openCreateModal(null)
            }
          >
            Ajouter
          </Button>
        </div>
      </div>

      <div className="border border-solid border-gray-200 rounded-lg overflow-hidden border-b-0">
        <Table
          className="reclamation-actions-table"
          size="small"
          loading={loading}
          dataSource={actions}
          columns={columns}
          rowKey={(record) =>
            record.id ??
            `${record.type}-${record.description}`
          }
          rowClassName={(record) =>
            record.__isChild
              ? 'child-action-row'
              : ''
          }
          pagination={false}
          locale={{
            emptyText:
              'Aucune action corrective',
          }}
          childrenColumnName={
            showChildren
              ? 'children'
              : '__no_children__'
          }
          components={{
            body: {
              row: ContextMenuRow,
            },
          }}
          expandable={
            showChildren
              ? {
                expandIconColumnIndex: 0,

                rowExpandable: (record) =>
                  Array.isArray(
                    record.children
                  ) &&
                  record.children.length > 0,

                expandIcon: ({
                  expanded,
                  onExpand,
                  record,
                }) =>
                  Array.isArray(
                    record.children
                  ) &&
                    record.children.length > 0 ? (
                    <Button
                      size="small"
                      type="text"
                      icon={
                        expanded ? (
                          <MinusOutlined />
                        ) : (
                          <PlusOutlined />
                        )
                      }
                      onClick={(event) =>
                        onExpand(
                          record,
                          event
                        )
                      }
                      style={{
                        marginRight: 6,
                      }}
                    />
                  ) : null,
              }
              : undefined
          }
        />
      </div>

      <Modal
        title={
          editingAction
            ? "Modifier l'action corrective"
            : parentId
              ? 'Nouvelle sous-action'
              : 'Nouvelle action corrective'
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingAction(null);
          setParentId(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={
          editingAction
            ? 'Enregistrer'
            : 'Créer'
        }
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            label="Type"
            name="type"
            initialValue="Action corrective"
          >
            <Select
              placeholder="Sélectionner un type"
              options={ACTION_TYPES.map(
                (type) => ({
                  label: type,
                  value: type,
                })
              )}
            />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[
              {
                required: true,
                message:
                  'La description est requise.',
              },
            ]}
          >
            <TextArea
              rows={3}
              placeholder="Détails de l'action corrective"
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Échéance"
              name="due_date"
              rules={[
                {
                  required: true,
                  message:
                    'La date est requise.',
                },
              ]}
            >
              <DatePicker
                className="w-full"
                format="DD/MM/YYYY"
              />
            </Form.Item>

            <Form.Item
              name="service_id"
              label="Processus"
            >
              <Select
                options={services}
                placeholder="Sélectionnez un service"
                suffixIcon={
                  <Building size={16} />
                }
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </div>
          {true ? (
            <Form.Item
              label="RSP de traitment"
              required
            >
              <div className="flex items-start gap-2">
                <Form.Item
                  name="person_id"
                  noStyle
                  rules={[
                    {
                      required: true,
                      message:
                        'Veuillez sélectionner une Responsable.',
                    },
                  ]}
                >
                  <Select
                    options={persons}
                    placeholder="Sélectionnez une Responsable"
                    loading={personsLoading}
                    suffixIcon={<User size={16} />}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                    className="flex-1"
                  />
                </Form.Item>

                <Tooltip title="Ajouter une Responsable">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setPersonModalOpen(true)}
                  />
                </Tooltip>
              </div>
            </Form.Item>
          ) : (
            <Form.Item
              label="Responsable"
              name="responsable_id"
              rules={[
                {
                  required: true,
                  message: 'Requis.',
                },
              ]}
            >
              <Select
                options={responsibles}
                placeholder="Sélectionnez un responsable"
                suffixIcon={<User size={16} />}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <PersonForm
        open={personModalOpen}
        onCancel={() =>
          setPersonModalOpen(false)
        }
        onSuccess={async (person) => {
          setPersonModalOpen(false);

          // Refresh the Select
          await fetchPersons();

          // Automatically select the new person
          if (person?.id) {
            form.setFieldValue(
              'person_id',
              Number(person.id)
            );
          }
        }}
      />
    </div>
  );
}