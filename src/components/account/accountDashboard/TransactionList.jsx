import * as React from "react";
import styled from "styled-components";

export function TransactionList() {
  const transactions = [
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
    {
      date: "1/10",
      description: "Santa Claus & ABC Plumbing",
      amount: "$0.10",
    },
  ];

  return (
    <TransactionSection>
      <TransactionHeader>
        <Title>Transaction History</Title>
        <HeaderIcon
          loading="lazy"
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/26fdea0f888a6986fd60d0fb8f19b5899d58e4226e06d94e3eed36bc2c302393?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f"
          alt=""
        />
      </TransactionHeader>

      {transactions.map((transaction, index) => (
        <TransactionRow key={index}>
          <TransactionDetails>
            <TransactionDate>{transaction.date}</TransactionDate>
            <TransactionDescription>
              {transaction.description}
            </TransactionDescription>
          </TransactionDetails>
          <TransactionAmount>{transaction.amount}</TransactionAmount>
        </TransactionRow>
      ))}
    </TransactionSection>
  );
}

const TransactionSection = styled.section`
  width: 100%;
  max-width: 323px;
  margin-top: 40px;
`;

const TransactionHeader = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
`;

const Title = styled.h3`
  font-size: 16px;
  color: rgba(26, 26, 26, 1);
  font-weight: 700;
  letter-spacing: -0.64px;
  line-height: 1;
`;

const HeaderIcon = styled.img`
  width: 10px;
  aspect-ratio: 1;
`;

const TransactionRow = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  margin-top: 14px;
  font-size: 12px;
  color: rgba(26, 26, 26, 0.5);
  font-weight: 400;
  letter-spacing: -0.48px;
  line-height: 2;
`;

const TransactionDetails = styled.div`
  display: flex;
  gap: 30px;
`;

const TransactionDate = styled.span`
  text-align: right;
`;

const TransactionDescription = styled.span`
  flex-grow: 1;
`;

const TransactionAmount = styled.span`
  text-align: right;
`;
