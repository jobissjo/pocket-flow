import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../ui/modal-sheet';
import { ReceiptPickerStep } from './receipt-picker-step';
import { AIProcessingStep } from './ai-processing-step';
import { ImportReviewForm } from './import-review-form';
import { ImportSuccessStep } from './import-success-step';
import { transactionImportsService } from '@/services/transactionImports';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess, hapticNotificationError } from '@/services/haptics';
import type {
  TransactionImportDraft,
  ConfirmImportPayload,
  ImportStep,
} from '@/services/transactionImportsTypes';

interface AITransactionImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AITransactionImportModal({
  visible,
  onClose,
  onSuccess,
}: AITransactionImportModalProps) {
  const { isDark } = useTheme();

  const [step, setStep] = useState<ImportStep>('idle');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState<string>('image/jpeg');
  const [selectedFileName, setSelectedFileName] = useState<string>('receipt.jpg');
  const [draft, setDraft] = useState<TransactionImportDraft | null>(null);
  const [confirmedData, setConfirmedData] = useState<ConfirmImportPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = () => {
    setStep('idle');
    setSelectedUri(null);
    setSelectedMime('image/jpeg');
    setSelectedFileName('receipt.jpg');
    setDraft(null);
    setConfirmedData(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (step === 'review' || step === 'confirming') {
      Alert.alert(
        'Discard Import?',
        'Are you sure you want to discard this extracted transaction?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (draft?.importId) {
                transactionImportsService.cancelImport(draft.importId).catch(() => {});
              }
              handleReset();
              onClose();
            },
          },
        ]
      );
    } else {
      handleReset();
      onClose();
    }
  };

  const handleSelectImage = (uri: string, mime: string, name: string) => {
    setSelectedUri(uri);
    setSelectedMime(mime);
    setSelectedFileName(name);
    setStep('file_selected');
    setErrorMessage(null);
  };

  const handleStartScan = async () => {
    if (!selectedUri) return;

    setStep('processing');
    setErrorMessage(null);

    try {
      const responseDraft = await transactionImportsService.uploadImage(
        selectedUri,
        selectedMime,
        selectedFileName
      );

      // Check for warnings
      const warnings = responseDraft.warnings || [];
      const hasMultiTx = warnings.some(
        (w) =>
          w.toLowerCase().includes('multiple transactions') ||
          w.toLowerCase().includes('bank statement')
      );

      if (hasMultiTx && responseDraft.amount === 0) {
        setDraft(responseDraft);
        setStep('multiple_transactions');
        return;
      }

      if (responseDraft.amount === 0 && !responseDraft.merchant.name) {
        setDraft(responseDraft);
        setStep('unsupported');
        return;
      }

      setDraft(responseDraft);
      setStep('review');
    } catch (err: any) {
      console.error('Scan error:', err);
      hapticNotificationError();
      const msg = err.message || 'Failed to analyze receipt document';

      if (
        msg.toLowerCase().includes('unsupported') ||
        msg.toLowerCase().includes('not a receipt')
      ) {
        setStep('unsupported');
        setErrorMessage(msg);
      } else if (
        msg.toLowerCase().includes('multiple transactions') ||
        msg.toLowerCase().includes('statement')
      ) {
        setStep('multiple_transactions');
        setErrorMessage(msg);
      } else {
        setStep('idle');
        setErrorMessage(msg);
      }
    }
  };

  const handleConfirm = async (payload: ConfirmImportPayload) => {
    setStep('confirming');
    setErrorMessage(null);

    try {
      if (draft?.importId) {
        await transactionImportsService.confirmImport(draft.importId, payload);
      }
      hapticNotificationSuccess();
      setConfirmedData(payload);
      setStep('success');
      onSuccess();
    } catch (err: any) {
      console.error('Confirm error:', err);
      hapticNotificationError();
      setStep('review');
      setErrorMessage(err.message || 'Failed to save transaction');
    }
  };

  const getModalTitle = () => {
    switch (step) {
      case 'processing':
        return 'Analyzing Receipt';
      case 'review':
      case 'confirming':
        return 'Review & Confirm';
      case 'success':
        return 'Success';
      case 'unsupported':
        return 'Unsupported Document';
      case 'multiple_transactions':
        return 'Multiple Transactions';
      default:
        return 'AI Transaction Import';
    }
  };

  const getModalSubtitle = () => {
    switch (step) {
      case 'processing':
        return 'Deep extraction in progress';
      case 'review':
      case 'confirming':
        return 'Verify extracted transaction fields';
      case 'success':
        return 'Transaction recorded';
      default:
        return 'Scan bills, receipts, and UPI screenshots';
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={handleClose}
      title={getModalTitle()}
      subtitle={getModalSubtitle()}
    >
      <View style={styles.container}>
        {/* Step 1: Image Picker */}
        {(step === 'idle' || step === 'file_selected') && (
          <ReceiptPickerStep
            selectedUri={selectedUri}
            onSelectImage={handleSelectImage}
            onClearImage={() => {
              setSelectedUri(null);
              setStep('idle');
            }}
            onProceedScan={handleStartScan}
            errorMessage={errorMessage}
          />
        )}

        {/* Step 2: Processing pipeline */}
        {step === 'processing' && <AIProcessingStep />}

        {/* Step 3: Review Form */}
        {(step === 'review' || step === 'confirming') && draft && (
          <ImportReviewForm
            draft={draft}
            onConfirm={handleConfirm}
            onCancel={handleClose}
            isSubmitting={step === 'confirming'}
          />
        )}

        {/* Step 4: Success View */}
        {step === 'success' && confirmedData && (
          <ImportSuccessStep
            confirmedData={confirmedData}
            onDone={() => {
              handleReset();
              onClose();
            }}
            onImportAnother={handleReset}
          />
        )}

        {/* Edge Case: Unsupported Document */}
        {step === 'unsupported' && (
          <View style={styles.stateNoticeContainer}>
            <View
              style={[
                styles.noticeIconCircle,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
              ]}
            >
              <Ionicons name="alert" size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.noticeTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Unsupported Document
            </Text>
            <Text style={[styles.noticeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {errorMessage ||
                "This image doesn't appear to contain a single clear transaction. Please upload a clear receipt, bill, or payment screenshot."}
            </Text>
            <TouchableOpacity
              onPress={handleReset}
              style={[
                styles.noticeActionBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
                },
              ]}
            >
              <Text style={[styles.noticeActionBtnText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Try Another Image
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edge Case: Multiple Transactions / Bank Statement */}
        {step === 'multiple_transactions' && (
          <View style={styles.stateNoticeContainer}>
            <View
              style={[
                styles.noticeIconCircle,
                { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' },
              ]}
            >
              <Ionicons name="documents-outline" size={32} color="#3B82F6" />
            </View>
            <Text style={[styles.noticeTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Statement Detected
            </Text>
            <Text style={[styles.noticeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              This document appears to contain multiple transactions (like a bank account statement). Please upload individual receipts or payment confirmation screenshots for best results.
            </Text>
            <TouchableOpacity
              onPress={handleReset}
              style={[
                styles.noticeActionBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
                },
              ]}
            >
              <Text style={[styles.noticeActionBtnText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Scan Individual Receipt
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  stateNoticeContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  noticeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  noticeActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  noticeActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
