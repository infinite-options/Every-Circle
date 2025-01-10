import * as React from "react";
import { Box, Typography, Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TransactionList } from "./TransactionList";
import { BudgetSection } from "./BudgetSection";
import NavigationBar from "../navigation/NavigationBar";
import Header from "../common/Header";
import { BalanceDisplay } from "./BalanceDisplay";
import StyledContainer from "../common/StyledContainer";

const MainContent = styled(Box)({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
});

export default function AccountPage() {
  const transactions = [
    {
      id: 1,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
    {
      id: 2,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
    {
      id: 3,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
    {
      id: 4,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
    {
      id: 5,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
    {
      id: 6,
      date: "1/10/2025",
      name: "Santa Clause & ABC Plumbing",
      amount: "$0.10",
    },
  ];

  return (
    <StyledContainer>
      <Header title="Account" />
      <MainContent>
        <BalanceDisplay balance="$48.20" />
        <BudgetSection />
        <TransactionList transactions={transactions} />
      </MainContent>
      <NavigationBar />
    </StyledContainer>
  );
}
