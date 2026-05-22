(function () {
  "use strict";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function hasInvalidQuantity(quantities) {
    return Object.values(quantities).some((value) => {
      const quantity = Number(value);
      return !Number.isInteger(quantity) || quantity < 0;
    });
  }

  function validateIdentity(formState, resolvedDepartment) {
    const errors = [];

    if (!resolvedDepartment) {
      errors.push("担当部署を入力または選択してください。");
    }

    if (!formState.applicantName.trim()) {
      errors.push("注文担当者名を入力してください。");
    }

    if (!formState.email.trim()) {
      errors.push("メールアドレスを入力してください。");
    } else if (!emailPattern.test(formState.email.trim())) {
      errors.push("メールアドレスの形式を確認してください。");
    }

    return errors;
  }

  function validateOrderForm(formState, draft) {
    const errors = validateIdentity(formState, draft.department);

    if (!draft.deliveryDate) {
      errors.push("受取日を選択してください。");
    }

    if (hasInvalidQuantity(formState.quantities)) {
      errors.push("個数は0以上の整数で入力してください。");
    }

    if (draft.totalQuantity < 1) {
      errors.push("メニューの合計個数が1以上になるように入力してください。");
    }

    return errors;
  }

  function validateChangeCancelForm(formState, draft) {
    const errors = [];

    if (!formState.actionType) {
      errors.push("処理種別を選択してください。");
    }

    if (!formState.targetOrderId.trim()) {
      errors.push("注文IDを入力してください。");
    }

    errors.push(...validateIdentity(formState, draft.department));

    if (formState.actionType === "change") {
      if (!draft.newDeliveryDate) {
        errors.push("変更後受取日を選択してください。");
      }

      if (hasInvalidQuantity(formState.quantities)) {
        errors.push("変更後個数は0以上の整数で入力してください。");
      }

      if (draft.totalQuantity < 1) {
        errors.push("変更後の合計個数が1以上になるように入力してください。");
      }
    }

    return errors;
  }

  window.BentoValidators = {
    validateOrderForm,
    validateChangeCancelForm
  };
})();
