import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  Select,
  message,
  DatePicker,
  Upload,
  Button,
} from 'antd';
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import reclamationApi from '../utils/reclamationApi';

const { TextArea } = Input;

const PRIORITIES = ['Normale', 'Critique', 'Urgente'];

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';
const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_MB = 10;

// Normalizes the Upload event into the fileList array for the Form
const normFile = (e) => (Array.isArray(e) ? e : e?.fileList);

export default function ReclamationStep3Modal({
  reclamationId,
  open,
  onClose,
  onUpdated,
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [existingFile, setExistingFile] = useState(null); // { name, url }

  // Watch the selected value
  const isJustifiee = Form.useWatch('is_justifiee', form);

  // Disable only when "Non" is selected
  const disabled = isJustifiee === 0;

  useEffect(() => {
    if (!open || !reclamationId) return;

    form.resetFields();
    setExistingFile(null);
    fetchReclamation();
  }, [open, reclamationId]);

  const populateForm = (data) => {
    form.setFieldsValue({
      processing_analysis: data?.processing_analysis || '',
      cause_analysis: data?.cause_analysis || '',
      priority: data?.priority || undefined,
      planned_closing_date: data?.planned_closing_date
        ? dayjs(data.planned_closing_date)
        : null,
      is_justifiee:
        data?.is_justifiee !== null && data?.is_justifiee !== undefined
          ? Number(data.is_justifiee)
          : undefined,
    });

    if (data?.justification_file_url) {
      setExistingFile({
        name: data.justification_file.split('/').pop(),
        url: data.justification_file_url,
      });
    }
  };

  const fetchReclamation = async () => {
    try {
      setSubmitting(true);

      const response = await reclamationApi.show(reclamationId);
      populateForm(response.data);
    } catch (err) {
      console.error(err);
      message.error("Impossible de charger les données de l'étape 3.");
    } finally {
      setSubmitting(false);
    }
  };

  const beforeUpload = (file) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      message.error('Format non supporté (images, PDF ou Word uniquement).');
      return Upload.LIST_IGNORE;
    }

    if (file.size / 1024 / 1024 > MAX_FILE_SIZE_MB) {
      message.error(`Le fichier ne doit pas dépasser ${MAX_FILE_SIZE_MB} Mo.`);
      return Upload.LIST_IGNORE;
    }

    return false; // prevent auto-upload, the file is sent with the form
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      const formData = new FormData();
      formData.append('processing_analysis', values.processing_analysis);
      formData.append('is_justifiee', values.is_justifiee); // 1 or 0

      // Only append optional fields when they have a value
      // (FormData would turn null/undefined into "null"/"undefined" strings)
      if (values.cause_analysis) {
        formData.append('cause_analysis', values.cause_analysis);
      }
      if (values.priority) {
        formData.append('priority', values.priority);
      }
      if (values.planned_closing_date) {
        formData.append(
          'planned_closing_date',
          values.planned_closing_date.format('YYYY-MM-DD')
        );
      }

      const file = values.justification_file?.[0]?.originFileObj;
      if (file) {
        formData.append('justification_file', file);
      }

      await reclamationApi.updateStep3(reclamationId, formData);

      message.success("L'analyse a été enregistrée avec succès.");

      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);

      if (err?.errorFields) return;

      message.error(
        err?.response?.data?.message ||
          "Échec de l'enregistrement de l'étape 3."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Analyse et Traitement"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="Enregistrer"
      cancelText="Annuler"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          label="Analyse de traitement"
          name="processing_analysis"
          rules={[{ required: true, message: 'Ce champ est requis.' }]}
        >
          <TextArea
            rows={3}
            placeholder="Analyse ou traitement effectué"
          />
        </Form.Item>

        <Form.Item
          label="Réclamation justifiée ?"
          name="is_justifiee"
          rules={[
            {
              required: true,
              message: 'Veuillez indiquer si la réclamation est justifiée.',
            },
          ]}
        >
          <Radio.Group>
            <Radio.Button value={1}>Oui</Radio.Button>
            <Radio.Button value={0}>Non</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="Causes identifiées"
          name="cause_analysis"
          rules={[{ required: !disabled, message: 'Ce champ est requis.' }]}
        >
          <TextArea
            rows={3}
            placeholder="Cause racine identifiée"
            disabled={disabled}
          />
        </Form.Item>

        <div className="flex gap-3">
          <Form.Item
            label="Priorité"
            name="priority"
            className="w-full"
            rules={[
              {
                required: !disabled,
                message: 'La priorité est requise.',
              },
            ]}
          >
            <Select
              placeholder="Sélectionner une priorité"
              disabled={disabled}
            >
              {PRIORITIES.map((priority) => (
                <Select.Option key={priority} value={priority}>
                  {priority}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Clôture prévue"
            name="planned_closing_date"
            className="w-full"
          >
            <DatePicker
              className="w-full"
              format="YYYY-MM-DD"
              disabled={disabled}
            />
          </Form.Item>
        </div>

        <Form.Item
          label="Pièce justificative"
          name="justification_file"
          valuePropName="fileList"
          getValueFromEvent={normFile}
          extra={`Images, PDF ou Word — max ${MAX_FILE_SIZE_MB} Mo`}
        >
          <Upload
            accept={ACCEPTED_EXTENSIONS}
            beforeUpload={beforeUpload}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Choisir un fichier</Button>
          </Upload>
        </Form.Item>

        {existingFile && (
          <div className="mb-4 text-sm">
            <PaperClipOutlined />{' '}
            <a href={existingFile.url} target="_blank" rel="noreferrer">
              {existingFile.name}
            </a>{' '}
            <span className="text-gray-500">
              (fichier actuel, remplacé si vous en choisissez un nouveau)
            </span>
          </div>
        )}
      </Form>
    </Modal>
  );
}