import * as React from "react";
import styled from "styled-components";

export function BudgetSection() {
  const budgetData = [
    { type: "per Impression", cost: "$0.01", cap: "$10.00", spend: "$ 0.50" },
    { type: "per Click", cost: "$0.10", cap: "$10.00", spend: "$ 7.20" },
    { type: "per Request", cost: "$1.00", cap: "$10.00", spend: "$ 3.00" },
  ];

  return (
    <BudgetContainer>
      <BudgetHeader>
        <BudgetTitle>Budget</BudgetTitle>
        <BudgetIcon
          loading="lazy"
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/26fdea0f888a6986fd60d0fb8f19b5899d58e4226e06d94e3eed36bc2c302393?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f"
          alt=""
        />
      </BudgetHeader>

      <BudgetLabels>
        <Label>Cost per</Label>
        <Label>Monthly Cap</Label>
        <Label>Current Spend</Label>
      </BudgetLabels>

      {budgetData.map((item, index) => (
        <BudgetRow key={index}>
          <BudgetType>{item.type}</BudgetType>
          <BudgetValue>{item.cost}</BudgetValue>
          <BudgetValue>{item.cap}</BudgetValue>
          <BudgetValue>{item.spend}</BudgetValue>
        </BudgetRow>
      ))}

      <TotalSpendRow>
        <SpendLabel>Max Monthly Spend :</SpendLabel>
        <BudgetValue>$30.00</BudgetValue>
        <BudgetValue>$10.70</BudgetValue>
      </TotalSpendRow>
    </BudgetContainer>
  );
}

const BudgetContainer = styled.section`
  width: 100%;
  max-width: 304px;
  margin-top: 37px;
`;

const BudgetHeader = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const BudgetTitle = styled.h3`
  font-size: 16px;
  color: rgba(26, 26, 26, 1);
  font-weight: 700;
  letter-spacing: -0.64px;
  line-height: 1;
`;

const BudgetIcon = styled.img`
  aspect-ratio: 1.11;
  width: 10px;
`;

const BudgetLabels = styled.div`
  display: flex;
  gap: 19px;
  margin-top: 8px;
`;

const Label = styled.span`
  font-size: 12px;
  color: rgba(26, 26, 26, 0.5);
  font-weight: 400;
  letter-spacing: -0.48px;
  line-height: 2;
`;

const BudgetRow = styled.div`
  display: flex;
  width: 100%;
  gap: 20px;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(26, 26, 26, 0.5);
  font-weight: 400;
  letter-spacing: -0.48px;
  line-height: 2;
`;

const BudgetType = styled.span`
  flex-grow: 1;
`;

const BudgetValue = styled.span`
  text-align: right;
`;

const TotalSpendRow = styled(BudgetRow)`
  margin-top: 8px;
`;

const SpendLabel = styled.span`
  flex-grow: 1;
  width: 129px;
`;
