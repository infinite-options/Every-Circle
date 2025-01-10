import * as React from "react";
import styled from "styled-components";
import { TransactionList } from "./TransactionList";
import { BudgetSection } from "./BudgetSection";
import { NavigationBar } from "./NavigationBar";

export function AccountDashboard() {
  return (
    <DashboardContainer>
      <HeaderSection>
        <AccountTitle>Account</AccountTitle>
      </HeaderSection>
      <MainContent>
        <BalanceDisplay>
          <BalanceLabel>Balance:</BalanceLabel>
          <BalanceAmount>$48.20</BalanceAmount>
        </BalanceDisplay>

        <BudgetSection />
        <TransactionList />

        <NetEarningLabel>Net Earning</NetEarningLabel>
        <EarningsGraph
          loading="lazy"
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/ad36ddce73070a59726ff714450249b9ff790634e328b7b382ef9855691d7703?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f"
          alt="Net earnings graph visualization"
        />
      </MainContent>
      <NavigationBar />
    </DashboardContainer>
  );
}

const DashboardContainer = styled.div`
  background-color: rgba(245, 245, 245, 1);
  display: flex;
  max-width: 480px;
  width: 100%;
  flex-direction: column;
  overflow: hidden;
  margin: 0 auto;
  border: 1px solid rgba(0, 0, 0, 1);
`;

const HeaderSection = styled.header`
  background-color: rgba(175, 82, 222, 1);
  border-radius: 50%;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 20px 70px;
`;

const AccountTitle = styled.h1`
  color: rgba(245, 245, 245, 1);
  font: 400 24px/1 Alata, sans-serif;
  letter-spacing: -0.96px;
  padding: 10px;
`;

const MainContent = styled.main`
  display: flex;
  margin-top: 42px;
  width: 100%;
  flex-direction: column;
  align-items: center;
  font-family: Lexend, sans-serif;
  padding: 0 4px 0 17px;
`;

const BalanceDisplay = styled.div`
  align-self: start;
  display: flex;
  width: 100%;
  max-width: 277px;
  gap: 20px;
  font-size: 16px;
  color: rgba(26, 26, 26, 1);
  white-space: nowrap;
  letter-spacing: -0.64px;
  line-height: 1;
  justify-content: space-between;
`;

const BalanceLabel = styled.span`
  font-weight: 700;
`;

const BalanceAmount = styled.span`
  font-weight: 400;
  text-align: right;
`;

const NetEarningLabel = styled.h2`
  color: rgba(26, 26, 26, 1);
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.64px;
  align-self: start;
  margin-top: 49px;
`;

const EarningsGraph = styled.img`
  aspect-ratio: 1.42;
  object-fit: contain;
  object-position: center;
  width: 176px;
  margin-top: 18px;
  max-width: 100%;
`;
